"use client";

import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";

const FAUCET_URL = "https://faucet.circle.com";
const DOCS_URL = "https://arc.network";
const EXPLORER_URL = "https://testnet.arcscan.app";

const EDITION = new Date().toLocaleDateString("en-US", {
  month: "long",
  year: "numeric",
});

export function Header() {
  return (
    <header>
      <div className="masthead-strip">
        <span>
          <span className="dot" />
          Live on Arc Testnet · Chain <b>5042002</b>
        </span>
        <span style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
          <a className="mast-link" href={FAUCET_URL} target="_blank" rel="noopener noreferrer">
            Faucet
          </a>
          <a className="mast-link" href={DOCS_URL} target="_blank" rel="noopener noreferrer">
            Docs
          </a>
          <a className="mast-link" href={EXPLORER_URL} target="_blank" rel="noopener noreferrer">
            Explorer
          </a>
          <ConnectButton
            accountStatus="address"
            chainStatus="none"
            showBalance={false}
          />
        </span>
      </div>

      <div className="rule-2" />

      <div className="masthead">
        <nav className="mast-l">
          <Link className="mast-link" href="/jobs">
            Browse Jobs
          </Link>
          <Link className="mast-link" href="/post">
            Post a Job
          </Link>
        </nav>

        <Link href="/" className="mast-title">
          Arc Job <span className="ampersand">&amp;</span> Board
        </Link>

        <div className="mast-r">
          <span>USDC-Native</span>
          <span>·</span>
          <span>ERC-8183 Escrow</span>
          <span>·</span>
          <span>{EDITION}</span>
        </div>
      </div>

      <div className="rule-thick" />
      <p className="mast-sub" style={{ padding: "10px 0 0" }}>
        The Onchain Quarterly — Tasks, Bounties &amp; Autonomous Labor
      </p>
    </header>
  );
}
