import { NextRequest, NextResponse } from "next/server";
import { AGENTS, AGENT_WALLETS, type AgentId } from "@/lib/agents";
import { resilientJSON } from "@/lib/ai";
import { rateLimit } from "@/lib/ratelimit";

// Gemini picks the best-fit agent for a job (used when the poster chose
// "Auto"). Design/UI heavy work biases to Gemini.
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, "route-agent", 20, 60_000);
  if (limited) return limited;
  try {
    const { description, category } = (await req.json()) as {
      description?: string;
      category?: string;
    };
    const desc = String(description ?? "").slice(0, 4000);
    if (!desc) {
      return NextResponse.json({ error: "description required" }, { status: 400 });
    }

    // Deterministic override: any build that produces a UI, a website, or a
    // dApp/contract goes to a strong design builder, regardless of what the LLM
    // router would pick (weaker general-coding models produced broken dApps).
    // The builder is configurable via BUILD_AGENT (default "claude" for its UI
    // design quality); the runner falls back to Gemini if that model errors.
    const isBuild =
      /defi|dapp|swap|stake|staking|lend|borrow|vault|yield|farm|amm|liquidity|nft|mint|dao|token|erc-?20|erc-?721|contract|solidity|web3|on-?chain|wallet|website|landing|frontend|front-end|\bui\b|\bapp\b|site|page|dashboard|game|build me|build a/i.test(
        desc
      );
    const isAudit = /audit|vulnerab|security review/i.test(desc);
    if (isBuild && !isAudit) {
      const want = (process.env.BUILD_AGENT ?? "claude").toLowerCase();
      const b =
        AGENTS.find((a) => a.id === want) ??
        AGENTS.find((a) => a.id === "claude") ??
        AGENTS.find((a) => a.id === "gemini")!;
      return NextResponse.json({
        agentId: b.id,
        name: b.name,
        address: AGENT_WALLETS[b.id],
        why: `build/dApp work routed to ${b.name} for UI/design quality`,
      });
    }

    const roster = AGENTS.map((a) => `- ${a.id}: ${a.strengths}`).join("\n");
    const prompt = `Pick the single best agent id for this job. Category: ${
      category ?? "General"
    }. Any build that ships a UI, website, or dApp MUST prefer "gemini" (strongest builder). Security audits prefer "claude". Reply ONLY as JSON {"agent":"<id>","why":"one short sentence"}.

Agents:
${roster}

Job:
${desc}`;

    let chosen: AgentId = "gemini";
    let why = "default";
    try {
      const raw = await resilientJSON(prompt, 256);
      const m = raw.match(/\{[\s\S]*\}/);
      const p = m ? (JSON.parse(m[0]) as { agent?: string; why?: string }) : {};
      if (p.agent && AGENTS.some((a) => a.id === p.agent)) {
        chosen = p.agent as AgentId;
        why = p.why ?? "";
      }
    } catch {
      /* fall back to gemini */
    }

    const agent = AGENTS.find((a) => a.id === chosen)!;
    return NextResponse.json({
      agentId: agent.id,
      name: agent.name,
      address: AGENT_WALLETS[agent.id],
      why,
    });
  } catch {
    return NextResponse.json(
      { agentId: "gemini", name: "Gemini", address: AGENT_WALLETS.gemini, why: "fallback" },
      { status: 200 }
    );
  }
}
