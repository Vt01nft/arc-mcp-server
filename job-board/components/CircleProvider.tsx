"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import {
  setCircleAuth,
  executeChallenge,
  abiFunctionSignature,
  serializeAbiParams,
} from "@/lib/circle-client";

type CircleState = {
  status: "signed-out" | "connecting" | "ready";
  email: string | null;
  address: string | null;
};

type CircleCtx = CircleState & {
  signIn: (email: string) => Promise<void>;
  signOut: () => void;
  /** PIN-sign a contract call through the Circle wallet. */
  execute: (params: {
    address: `0x${string}`;
    abi: readonly unknown[];
    functionName: string;
    args: readonly unknown[];
  }) => Promise<void>;
};

const Ctx = createContext<CircleCtx | null>(null);

export function useCircle(): CircleCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCircle must be used within CircleProvider");
  return c;
}

export function CircleProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<CircleState["status"]>("signed-out");
  const [email, setEmail] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [session, setSession] = useState<{
    appId: string;
    userToken: string;
    walletId: string;
  } | null>(null);

  const signIn = useCallback(async (rawEmail: string) => {
    const id = rawEmail.trim().toLowerCase();
    if (!id) throw new Error("Enter an email");
    setStatus("connecting");
    try {
      let s = await fetch("/api/circle/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: id }),
      }).then((r) => r.json());
      if (s.error) throw new Error(s.error);

      const appId: string = s.appId;
      setCircleAuth(appId, s.userToken, s.encryptionKey);

      // First time: create the Arc wallet behind a PIN challenge.
      if (!s.wallets || s.wallets.length === 0) {
        const init = await fetch("/api/circle/initialize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userToken: s.userToken }),
        }).then((r) => r.json());
        if (init.error) throw new Error(init.error);
        await executeChallenge(appId, init.challengeId); // Circle PIN UI

        // Re-fetch to pick up the freshly created wallet.
        s = await fetch("/api/circle/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: id }),
        }).then((r) => r.json());
        if (s.error) throw new Error(s.error);
        setCircleAuth(appId, s.userToken, s.encryptionKey);
      }

      const w = (s.wallets ?? [])[0];
      if (!w) throw new Error("Circle wallet not ready, try again");
      setSession({ appId, userToken: s.userToken, walletId: w.id });
      setAddress(w.address);
      setEmail(id);
      setStatus("ready");
    } catch (e) {
      setStatus("signed-out");
      throw e;
    }
  }, []);

  const signOut = useCallback(() => {
    setSession(null);
    setAddress(null);
    setEmail(null);
    setStatus("signed-out");
  }, []);

  const execute = useCallback<CircleCtx["execute"]>(
    async ({ address: contractAddress, abi, functionName, args }) => {
      if (!session) throw new Error("Sign in with Circle first");
      const res = await fetch("/api/circle/contract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userToken: session.userToken,
          walletId: session.walletId,
          contractAddress,
          abiFunctionSignature: abiFunctionSignature(abi, functionName),
          abiParameters: serializeAbiParams(args),
        }),
      }).then((r) => r.json());
      if (res.error) throw new Error(res.error);
      await executeChallenge(session.appId, res.challengeId); // Circle PIN UI
    },
    [session]
  );

  const value = useMemo<CircleCtx>(
    () => ({ status, email, address, signIn, signOut, execute }),
    [status, email, address, signIn, signOut, execute]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
