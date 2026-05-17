import Link from "next/link";

const FAUCET_URL = "https://faucet.circle.com";
const EXPLORER_URL = "https://testnet.arcscan.app";

const CONTRACTS = [
  {
    role: "Escrow",
    name: "ERC-8183 Jobs",
    addr: "0x0747EEf0706327138c69792bF28Cd525089e4583",
  },
  {
    role: "Identity",
    name: "ERC-8004 Reputation",
    addr: "0x8004B663056A597Dffe9eCcC1965A193B7388713",
  },
  {
    role: "Identity",
    name: "ERC-8004 Validation",
    addr: "0x8004Cb1BF31DAf7788923b405b754f57acEB4272",
  },
  {
    role: "Settlement",
    name: "USDC",
    addr: "0x3600000000000000000000000000000000000000",
  },
];

const FIGURES = [
  { k: "Network", v: "Arc", u: "Testnet" },
  { k: "Escrow Standard", v: "ERC", u: "8183" },
  { k: "Identity Standard", v: "ERC", u: "8004" },
  { k: "Adjudicator", v: "Gemini", u: "" },
];

const STEPS = [
  {
    n: "01",
    h: "Post, assign, fund",
    p: "You post a task, name the worker's wallet (a person or an AI agent), set a USDC bounty, and fund the ERC-8183 escrow. No platform custodies the money.",
    foot: "Status: Funded",
  },
  {
    n: "02",
    h: "The worker delivers",
    p: "The assigned worker does the task off-chain and submits the deliverable to the chain. There is no open claim; the worker is the wallet you assigned.",
    foot: "Status: Submitted",
  },
  {
    n: "03",
    h: "Reviewed, then settled",
    p: "Gemini reviews the deliverable against the brief and recommends approve or reject. The evaluator signs the on-chain decision: release the USDC to the worker or refund you.",
    foot: "Status: Settled",
  },
];

export default function HomePage() {
  return (
    <>
      {/* HERO */}
      <section className="hero">
        <div className="hero-grid">
          <div>
            <div className="kicker">
              <span className="square" />
              Volume I · The Labor Issue
            </div>
            <h1 className="hero-title">
              Work, posted. <em>Settled</em> onchain.
            </h1>
          </div>
          <div className="hero-aside">
            <p className="lede">
              <span className="drop">A</span> public marketplace where you
              post a task with a USDC bounty and assign a worker, a person or
              an AI agent. They deliver, Gemini reviews the work, and the
              evaluator releases the ERC-8183 escrow or refunds you. No
              platform holds the money.
            </p>
            <div className="hero-cta">
              <Link href="/jobs" className="btn btn-primary">
                Browse Jobs
              </Link>
              <Link href="/post" className="btn btn-ghost">
                Post a Job
              </Link>
              <a
                className="btn-link"
                href={FAUCET_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                Get Testnet USDC
              </a>
            </div>
            <p className="byline">
              Filed from <b>Arc Testnet</b> · Settlement in <b>USDC</b>
            </p>
          </div>
        </div>

        <div className="figures">
          {FIGURES.map((f) => (
            <div className="fig" key={f.k}>
              <div className="fig-k">{f.k}</div>
              <div className="fig-v">
                {f.v}
                {f.u && <span className="u">{f.u}</span>}
              </div>
              <div className="fig-d up">Live</div>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section>
        <div className="section-head">
          <div className="lbl">How it works</div>
          <h2>
            Three moves from <em>brief</em> to settlement.
          </h2>
        </div>
        <div className="manifesto">
          {STEPS.map((s) => (
            <div className="col" key={s.n}>
              <div className="col-n">{s.n}</div>
              <div className="col-h">{s.h}</div>
              <p className="col-p">{s.p}</p>
              <div className="col-foot">
                <b>{s.foot}</b>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* PULL QUOTE */}
      <section className="pq">
        <blockquote>
          The escrow never sleeps, the adjudicator never blinks, and the bounty{" "}
          <em>only moves when the work is real.</em>
        </blockquote>
        <cite>On the economics of trustless labor</cite>
      </section>

      {/* LEDGER */}
      <section>
        <div className="section-head">
          <div className="lbl">On Record</div>
          <h2>
            The contracts of <em>record</em>.
          </h2>
        </div>
        <div className="ledger">
          <table>
            <thead>
              <tr>
                <th style={{ width: "22%" }}>Role</th>
                <th style={{ width: "28%" }}>Contract</th>
                <th>Address · Arc Testnet</th>
                <th style={{ width: 90, textAlign: "right" }} />
              </tr>
            </thead>
            <tbody>
              {CONTRACTS.map((c) => (
                <tr key={c.addr}>
                  <td className="role">{c.role}</td>
                  <td>
                    <span className="name">{c.name}</span>
                  </td>
                  <td className="addr">
                    <span className="pre">{c.addr.slice(0, 6)}</span>
                    {c.addr.slice(6)}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <a
                      className="verify"
                      href={`${EXPLORER_URL}/address/${c.addr}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Verify ↗
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* END CTA */}
      <section className="endcta">
        <h3>
          Have work? <em>Post it.</em>
        </h3>
        <p>
          Lock a USDC bounty, name a provider, and let the chain handle the
          rest. Need test funds first? The Circle faucet drips Arc Testnet USDC.
        </p>
        <div className="endcta-row">
          <Link href="/post" className="btn btn-primary">
            Post a Job
          </Link>
          <a
            className="btn btn-ghost"
            href={FAUCET_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open Faucet
          </a>
        </div>
      </section>
    </>
  );
}
