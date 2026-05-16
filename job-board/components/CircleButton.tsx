"use client";

import { useState } from "react";
import { useCircle } from "./CircleProvider";

// Match the RainbowKit Connect Wallet button's prominence
// (dark-blue accent, light text, bold, rounded).
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

export function CircleButton() {
  const { status, address, email, signIn, signOut } = useCircle();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [err, setErr] = useState<string | null>(null);

  if (status === "ready" && address) {
    return (
      <button
        title={`Circle wallet ${address} (${email})`}
        onClick={signOut}
        style={btn}
      >
        ◑ {address.slice(0, 6)}…{address.slice(-4)} · sign out
      </button>
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
