"use client";

import { useEffect, useState } from "react";
import { formatUnits } from "viem";
import { useCircle } from "./CircleProvider";
import { publicClient } from "@/lib/viem";

// Match the RainbowKit Connect Wallet button's prominence.
const btn: React.CSSProperties = {
  cursor: "pointer",
  background: "var(--accent)",
  color: "var(--paper)",
  border: 0,
  borderRadius: 8,
  padding: "9px 16px",
  fontFamily: "var(--sans)",
  fontSize: 14,
  fontWeight: 700,
  lineHeight: 1,
  letterSpacing: "0.01em",
};

const chip: React.CSSProperties = {
  cursor: "pointer",
  background: "transparent",
  color: "var(--ink)",
  border: "1px solid var(--accent)",
  borderRadius: 8,
  padding: "8px 12px",
  fontFamily: "var(--mono)",
  fontSize: 12.5,
  fontWeight: 600,
  lineHeight: 1,
};

export function CircleButton() {
  const { status, address, email, signIn, signOut } = useCircle();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [bal, setBal] = useState<string | null>(null);

  const refreshBal = async (addr: string) => {
    try {
      const wei = await publicClient.getBalance({
        address: addr as `0x${string}`,
      });
      // USDC is the native gas token on Arc (18-decimal precision).
      setBal(Number(formatUnits(wei, 18)).toFixed(3));
    } catch {
      setBal(null);
    }
  };

  useEffect(() => {
    if (status === "ready" && address) refreshBal(address);
  }, [status, address]);

  if (status === "ready" && address) {
    return (
      <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
        <button
          style={chip}
          title="Click to copy your full Circle wallet address"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(address);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              /* clipboard blocked */
            }
          }}
        >
          ◑ {address.slice(0, 6)}…{address.slice(-4)}{" "}
          {copied ? "✓ copied" : "⧉ copy"}
        </button>
        <button
          style={{ ...chip, cursor: "default" }}
          title={`Arc USDC balance for ${address} (${email}). Click to refresh.`}
          onClick={() => refreshBal(address)}
        >
          {bal === null ? "… USDC" : `${bal} USDC`}
        </button>
        <button style={btn} onClick={signOut}>
          Sign out
        </button>
      </span>
    );
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={btn}>
        ◑ Sign in with Circle
      </button>
    );
  }

  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
      <input
        type="email"
        placeholder="email"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="field"
        style={{ height: 34, padding: "0 8px", width: 170 }}
      />
      <button
        disabled={status === "connecting"}
        style={{ ...btn, opacity: status === "connecting" ? 0.6 : 1 }}
        onClick={async () => {
          setErr(null);
          try {
            await signIn(value);
            setOpen(false);
          } catch (e) {
            setErr((e as Error).message);
          }
        }}
      >
        {status === "connecting" ? "…" : "Go"}
      </button>
      {err && <span style={{ color: "var(--bad)", fontSize: 10 }}>{err}</span>}
    </span>
  );
}
