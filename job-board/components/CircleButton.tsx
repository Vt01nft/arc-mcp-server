"use client";

import { useState } from "react";
import { useCircle } from "./CircleProvider";

export function CircleButton() {
  const { status, address, email, signIn, signOut } = useCircle();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [err, setErr] = useState<string | null>(null);

  if (status === "ready" && address) {
    return (
      <button
        className="mast-link"
        title={`Circle wallet ${address} (${email})`}
        onClick={signOut}
        style={{ cursor: "pointer", background: "none", border: 0 }}
      >
        ◑ {address.slice(0, 6)}…{address.slice(-4)} · sign out
      </button>
    );
  }

  if (!open) {
    return (
      <button
        className="mast-link"
        onClick={() => setOpen(true)}
        style={{ cursor: "pointer", background: "none", border: 0 }}
      >
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
        style={{ height: 30, padding: "0 8px", width: 170 }}
      />
      <button
        className="mast-link"
        disabled={status === "connecting"}
        style={{ cursor: "pointer", background: "none", border: 0 }}
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
      {err && (
        <span style={{ color: "var(--bad)", fontSize: 10 }}>{err}</span>
      )}
    </span>
  );
}
