"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  setCircleAuth,
  executeChallenge,
  abiFunctionSignature,
  serializeAbiParams,
  resetSdk,
} from "@/lib/circle-client";
import { formatUnits } from "viem";
import { publicClient } from "@/lib/viem";

type CircleState = {
  status: "signed-out" | "connecting" | "ready";
  email: string | null;
  address: string | null;
  balance: string | null; // native Arc USDC, 3dp string
};

type CircleCtx = CircleState & {
  signIn: (email: string) => Promise<void>;
  signOut: () => void;
  refreshBalance: () => Promise<void>;
  execute: (params: {
    address: `0x${string}`;
    abi: readonly unknown[];
    functionName: string;
    args: readonly unknown[];
  }) => Promise<void>;
};

const Ctx = createContext<CircleCtx | null>(null);
// sessionStorage: survives refresh + in-tab navigation, clears when the tab
// is closed. Matches "stay signed in until I sign out or close the page".
const STORE_KEY = "arc_circle_email";

export function useCircle(): CircleCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCircle must be used within CircleProvider");
  return c;
}

export function CircleProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<CircleState["status"]>("signed-out");
  const [email, setEmail] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [session, setSession] = useState<{
    appId: string;
    userToken: string;
    walletId: string;
  } | null>(null);
  // When the Circle token was last re-minted. We only refresh it if it is
  // older than the TTL, so three signatures in one post flow do not each
  // pay for a session round trip + SDK rebuild.
  const lastRefreshRef = useRef(0);
  const TOKEN_TTL_MS = 5 * 60 * 1000;

  async function fetchBal(addr: string) {
    try {
      const wei = await publicClient.getBalance({
        address: addr as `0x${string}`,
      });
      setBalance(Number(formatUnits(wei, 18)).toFixed(3));
    } catch {
      /* leave previous */
    }
  }
  const refreshBalance = useCallback(async () => {
    if (address) await fetchBal(address);
  }, [address]);

  // Establish (or re-establish) a session for an email. The Circle wallet
  // already exists for a returning user, so a fresh userToken is minted
  // silently with no PIN; PIN is only needed for first-time wallet creation
  // (allowInit) and per-transaction signing.
  const hydrate = useCallback(
    async (rawEmail: string, allowInit: boolean) => {
      const id = rawEmail.trim().toLowerCase();
      if (!id) throw new Error("Enter an email");
      setStatus("connecting");

      let s = await fetch("/api/circle/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: id }),
      }).then((r) => r.json());
      if (s.error) throw new Error(s.error);

      const appId: string = s.appId;
      setCircleAuth(appId, s.userToken, s.encryptionKey);

      if (!s.wallets || s.wallets.length === 0) {
        if (!allowInit) throw new Error("No Circle wallet for this email yet");
        const init = await fetch("/api/circle/initialize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userToken: s.userToken }),
        }).then((r) => r.json());
        if (init.error) throw new Error(init.error);
        await executeChallenge(appId, init.challengeId); // Circle PIN UI

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
      lastRefreshRef.current = Date.now();
      setAddress(w.address);
      setEmail(id);
      setStatus("ready");
      fetchBal(w.address);
      try {
        sessionStorage.setItem(STORE_KEY, id);
      } catch {
        /* storage unavailable */
      }
    },
    []
  );

  // Restore the session on every page load if the tab still has it.
  useEffect(() => {
    async function restore() {
      let saved: string | null = null;
      try {
        saved = sessionStorage.getItem(STORE_KEY);
      } catch {
        saved = null;
      }
      if (!saved) return;
      try {
        await hydrate(saved, false);
      } catch {
        try {
          sessionStorage.removeItem(STORE_KEY);
        } catch {
          /* ignore */
        }
        setStatus("signed-out");
      }
    }
    restore();
  }, [hydrate]);

  const signIn = useCallback(
    async (rawEmail: string) => {
      try {
        await hydrate(rawEmail, true);
      } catch (e) {
        setStatus("signed-out");
        throw e;
      }
    },
    [hydrate]
  );

  const signOut = useCallback(() => {
    try {
      sessionStorage.removeItem(STORE_KEY);
    } catch {
      /* ignore */
    }
    setSession(null);
    setAddress(null);
    setBalance(null);
    setEmail(null);
    setStatus("signed-out");
  }, []);

  const execute = useCallback<CircleCtx["execute"]>(
    async ({ address: contractAddress, abi, functionName, args }) => {
      if (!session && !email) throw new Error("Sign in with Circle first");

      let appId = session?.appId ?? "";
      let userToken = session?.userToken ?? "";
      let walletId = session?.walletId ?? "";

      // Refresh the Circle session only when it is stale (or missing). User
      // tokens expire (~60 min) and a dead SDK socket on a long-lived page
      // surfaces as an opaque "Network error". Throttling to the TTL means
      // three signatures in one post reuse one fresh token instead of doing
      // a session round trip + SDK rebuild before every PIN.
      const stale =
        !session || Date.now() - lastRefreshRef.current > TOKEN_TTL_MS;
      if (email && stale) {
        try {
          const s = await fetch("/api/circle/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: email }),
          }).then((r) => r.json());
          if (!s.error && s.userToken) {
            appId = s.appId;
            userToken = s.userToken;
            walletId = (s.wallets ?? [])[0]?.id ?? walletId;
            resetSdk();
            setCircleAuth(appId, s.userToken, s.encryptionKey);
            setSession({ appId, userToken, walletId });
            lastRefreshRef.current = Date.now();
          }
        } catch {
          /* fall back to the existing session token */
        }
      }
      if (!appId || !userToken || !walletId)
        throw new Error("Sign in with Circle first");

      const res = await fetch("/api/circle/contract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userToken,
          walletId,
          contractAddress,
          abiFunctionSignature: abiFunctionSignature(abi, functionName),
          abiParameters: serializeAbiParams(args),
        }),
      }).then((r) => r.json());
      if (res.error) throw new Error(res.error);
      await executeChallenge(appId, res.challengeId); // Circle PIN UI
    },
    [session, email]
  );

  const value = useMemo<CircleCtx>(
    () => ({
      status,
      email,
      address,
      balance,
      signIn,
      signOut,
      refreshBalance,
      execute,
    }),
    [status, email, address, balance, signIn, signOut, refreshBalance, execute]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
