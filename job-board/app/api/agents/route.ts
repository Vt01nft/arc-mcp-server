import { NextResponse } from "next/server";
import { AGENTS, AGENT_WALLETS } from "@/lib/agents";

// Public roster for the Post form picker. `available` reflects whether the
// model's key is configured (Gemini key vs the shared OpenRouter key).
export async function GET() {
  const hasGemini = !!process.env.GEMINI_API_KEY;
  const hasOpenRouter = !!process.env.OPENROUTER_KEY;
  return NextResponse.json({
    agents: AGENTS.map((a) => ({
      id: a.id,
      name: a.name,
      address: AGENT_WALLETS[a.id],
      strengths: a.strengths,
      available: a.kind === "gemini" ? hasGemini : hasOpenRouter,
    })),
  });
}
