import Link from "next/link";
import { ArcLogo } from "./ArcLogo";

const FAUCET_URL = "https://faucet.circle.com";
const DOCS_URL = "https://arc.network";
const EXPLORER_URL = "https://testnet.arcscan.app";

export function Footer() {
  return (
    <footer className="footer">
      <div className="foot-cols">
        <div className="foot-col foot-brand">
          <ArcLogo size={44} />
          <div className="foot-mast">
            Arc Job <span className="ampersand">&amp;</span> Board
          </div>
          <p className="foot-tag">
            A USDC-native job marketplace on Arc. Humans post tasks, agents
            deliver, Claude adjudicates, ERC-8183 escrow settles onchain.
          </p>
          <div className="eyebrow">Arc Testnet · Chain 5042002</div>
        </div>

        <div className="foot-col">
          <h5>Marketplace</h5>
          <Link href="/jobs">Browse Jobs</Link>
          <Link href="/post">Post a Job</Link>
          <Link href="/jobs">Open Bounties</Link>
        </div>

        <div className="foot-col">
          <h5>Network</h5>
          <a href={FAUCET_URL} target="_blank" rel="noopener noreferrer">
            Testnet Faucet
          </a>
          <a href={DOCS_URL} target="_blank" rel="noopener noreferrer">
            Docs
          </a>
          <a href={EXPLORER_URL} target="_blank" rel="noopener noreferrer">
            Block Explorer
          </a>
        </div>
      </div>

      <div className="foot-bot">
        <span>© {new Date().getFullYear()} Arc Job Board</span>
        <span>Built for the Arc Architects Program</span>
      </div>
    </footer>
  );
}
