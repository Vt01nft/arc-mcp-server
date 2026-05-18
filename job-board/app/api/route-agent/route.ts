import { NextRequest, NextResponse } from "next/server";
import { AGENTS, AGENT_WALLETS, type AgentId } from "@/lib/agents";
import { geminiJSON } from "@/lib/gemini";

// Gemini picks the best-fit agent for a job (used when the poster chose
// "Auto"). Design/UI heavy work biases to Gemini.
export async function POST(req: NextRequest) {
  try {
    const { description, category } = (await req.json()) as {
      description?: string;
      category?: string;
    };
    const desc = String(description ?? "").slice(0, 4000);
    if (!desc) {
      return NextResponse.json({ error: "description required" }, { status: 400 });
    }

    const roster = AGENTS.map((a) => `- ${a.id}: ${a.strengths}`).join("\n");
    const prompt = `Pick the single best agent id for this job. Category: ${
      category ?? "General"
    }. UI/design/website work should prefer "gemini". Security audits prefer "claude". Reply ONLY as JSON {"agent":"<id>","why":"one short sentence"}.

Agents:
${roster}

Job:
${desc}`;

    let chosen: AgentId = "gemini";
    let why = "default";
    try {
      const raw = await geminiJSON(prompt, 256);
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
