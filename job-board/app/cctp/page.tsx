"use client";

import { useState } from "react";
import Link from "next/link";
import { useCircle } from "@/components/CircleProvider";

const EXPLORER = "https://testnet.arcscan.app";
const OP_MESSENGER = "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA";

export default function CctpPage() {
  const circle = useCircle();
  const [burnTx, setBurnTx] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [mintTx, setMintTx] = useState<string | null>(null);

  async function complete() {
    setBusy(true);
    setMsg(null);
    setMintTx(null);
    try {
      // The mint can take a few minutes while Circle finalizes the attestation.
      // Retry on the 202 "not ready" responses.
      for (let i = 0; i < 40; i++) {
        const res = await fetch("/api/cctp/receive", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ burnTxHash: burnTx.trim() }),
        });
        const data = await res.json();
        if (res.ok && data.ok) {
          setMintTx(data.mintTx);
          setMsg("USDC minted on Arc.");
          return;
        }
        if (res.status === 202) {
          setMsg(`Waiting for Circle attestation (${data.status})… this can take a few minutes.`);
          await new Promise((r) => setTimeout(r, 8000));
          continue;
        }
        throw new Error(data.error ?? "failed");
      }
      setMsg("Still pending after several minutes. Try again shortly with the same tx.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 20px 0" }}>
      <div className="kicker">
        <span className="square" />
        Cross-Chain Funding
      </div>
      <h1 className="serif-h" style={{ fontSize: 46, margin: "0 0 8px" }}>
        Fund from Optimism
      </h1>
      <p className="lede" style={{ fontSize: 15, margin: "0 0 28px", maxWidth: 620 }}>
        Bring USDC to Arc from Optimism Sepolia with Circle&rsquo;s CCTP v2. You
        burn USDC on Optimism; Arc mints the same amount to your wallet. We pay
        the Arc-side gas, so you don&rsquo;t need Arc USDC to receive.
      </p>

      <div className="paper-card-soft" style={{ marginBottom: 22 }}>
        <div className="eyebrow accent" style={{ marginBottom: 10 }}>
          Step 1 — burn on Optimism Sepolia (your wallet)
        </div>
        <ol style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.7, color: "var(--ink-2)" }}>
          <li>
            On Optimism Sepolia, approve USDC to the TokenMessenger{" "}
            <span className="mono">{OP_MESSENGER.slice(0, 10)}…</span>.
          </li>
          <li>
            Call <span className="mono">depositForBurn</span> with
            destinationDomain <b>26</b> (Arc) and your Arc address as the
            mintRecipient. Copy the burn transaction hash.
          </li>
        </ol>
        <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--ink-3)" }}>
          Your Arc address:{" "}
          <span className="mono">{circle.address ?? "sign in with Circle"}</span>.
          A scripted burn is in <span className="mono">scripts/cctp-burn.mjs</span>.
        </p>
      </div>

      <div className="paper-card" style={{ marginBottom: 22 }}>
        <div className="eyebrow accent" style={{ marginBottom: 10 }}>
          Step 2 — complete on Arc
        </div>
        <label className="label">Burn transaction hash (Optimism Sepolia)</label>
        <input
          className="field mono"
          value={burnTx}
          onChange={(e) => setBurnTx(e.target.value)}
          placeholder="0x…"
        />
        <button
          type="button"
          className="btn btn-primary"
          onClick={complete}
          disabled={busy || !/^0x[0-9a-fA-F]{64}$/.test(burnTx.trim())}
          style={{ height: 44, padding: "0 18px", fontSize: 13, marginTop: 14 }}
        >
          {busy ? "Completing…" : "Complete transfer on Arc"}
        </button>
        {msg && (
          <p style={{ margin: "14px 0 0", fontSize: 13, color: "var(--ink-2)" }}>{msg}</p>
        )}
        {mintTx && (
          <p style={{ margin: "8px 0 0", fontSize: 13 }}>
            <a
              className="mast-link mono"
              href={`${EXPLORER}/tx/${mintTx}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              View mint on ArcScan ↗
            </a>
          </p>
        )}
      </div>

      <p style={{ fontSize: 13, color: "var(--ink-3)" }}>
        Once funded, head to <Link href="/post" className="mast-link">Post a Job</Link>.
      </p>
    </div>
  );
}
