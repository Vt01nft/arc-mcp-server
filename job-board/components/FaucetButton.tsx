"use client";

import { useState } from "react";
import { useCircle } from "./CircleProvider";

export function FaucetButton() {
  const { address } = useCircle();
  const [open, setOpen] = useState(false);
  const [addr, setAddr] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);

  // Prefill with the signed-in Circle wallet so there is nothing to paste.
  const value = addr || address || "";

  async function request() {
    setBusy(true);
    setMsg(null);
    setFallbackUrl(null);
    try {
      const r = await fetch("/api/faucet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: value }),
      }).then((x) => x.json());
      setMsg(r.message ?? (r.ok ? "Requested." : "Failed."));
      if (r.fallback && r.faucetUrl) {
        setFallbackUrl(r.faucetUrl);
        try {
          await navigator.clipboard.writeText(value);
          setMsg((m) => `${m} (address copied)`);
        } catch {
          /* clipboard blocked */
        }
      }
    } catch {
      setMsg("Faucet request failed.");
      setFallbackUrl("https://faucet.circle.com");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        className="mast-link"
        onClick={() => setOpen(true)}
        style={{ cursor: "pointer", background: "none", border: 0 }}
      >
        Faucet
      </button>
    );
  }

  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
      <input
        type="text"
        placeholder="0x wallet address"
        value={value}
        onChange={(e) => setAddr(e.target.value)}
        className="field mono"
        style={{ height: 32, padding: "0 8px", width: 230, fontSize: 12 }}
      />
      <button
        className="mast-link"
        disabled={busy}
        onClick={request}
        style={{ cursor: "pointer", background: "none", border: 0 }}
      >
        {busy ? "…" : "Get USDC"}
      </button>
      {fallbackUrl && (
        <a
          className="mast-link"
          href={fallbackUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open faucet ↗
        </a>
      )}
      <button
        className="mast-link"
        onClick={() => setOpen(false)}
        style={{ cursor: "pointer", background: "none", border: 0 }}
      >
        ✕
      </button>
      {msg && (
        <span style={{ fontSize: 10, color: "var(--ink-3)", maxWidth: 240 }}>
          {msg}
        </span>
      )}
    </span>
  );
}
