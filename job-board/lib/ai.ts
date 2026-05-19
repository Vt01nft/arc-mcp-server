// Model layer. Gemini agent uses GEMINI_API_KEY directly; all other agents
// go through one OpenRouter key. geminiJSON (from ./gemini) is reused for the
// router and the self-verify gate.
import type { Agent } from "./agents";
import { geminiJSON } from "./gemini";

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

/** Free-form text from Gemini (thinking off so the budget goes to output). */
export async function geminiText(
  system: string,
  user: string,
  maxOutputTokens = 65536
): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not set");
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ parts: [{ text: user }] }],
        generationConfig: {
          maxOutputTokens,
          temperature: 0.4,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    }
  );
  if (!res.ok) {
    const b = await res.text().catch(() => "");
    const e = new Error(`Gemini ${res.status}: ${b.slice(0, 200)}`) as Error & {
      status?: number;
    };
    e.status = res.status;
    throw e;
  }
  const d = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const t = d?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!t) throw new Error("Gemini returned no text");
  return t;
}

/** OpenAI-compatible call through OpenRouter for non-Gemini agents. */
export async function openrouterText(
  model: string,
  system: string,
  user: string,
  maxTokens = 64000
): Promise<string> {
  const key = process.env.OPENROUTER_KEY;
  if (!key) throw new Error("OPENROUTER_KEY not set");
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://arc-job-board.vercel.app",
      "X-Title": "Arc Job Board Agents",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature: 0.4,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    const b = await res.text().catch(() => "");
    const e = new Error(
      `OpenRouter ${res.status}: ${b.slice(0, 200)}`
    ) as Error & { status?: number };
    e.status = res.status;
    throw e;
  }
  const d = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const t = d?.choices?.[0]?.message?.content;
  if (!t) throw new Error("OpenRouter returned no text");
  return t;
}

/** Strict-JSON completion through OpenRouter (fallback for geminiJSON). */
export async function openrouterJSON(
  prompt: string,
  maxTokens = 1024,
  model = process.env.OPENROUTER_JSON_MODEL ?? "openai/gpt-4o-mini"
): Promise<string> {
  const key = process.env.OPENROUTER_KEY;
  if (!key) throw new Error("OPENROUTER_KEY not set");
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://arc-job-board.vercel.app",
      "X-Title": "Arc Job Board Agents",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You return only a single valid JSON object. No prose, no code fences.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) {
    const b = await res.text().catch(() => "");
    const e = new Error(
      `OpenRouter JSON ${res.status}: ${b.slice(0, 200)}`
    ) as Error & { status?: number };
    e.status = res.status;
    throw e;
  }
  const d = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const t = d?.choices?.[0]?.message?.content;
  if (!t) throw new Error("OpenRouter JSON returned no text");
  return t;
}

/**
 * JSON completion that survives a Gemini outage/quota (429). Tries Gemini
 * first (cheap, fast), falls back to OpenRouter so the evaluator, self-verify
 * and router never hard-fail just because the Gemini free tier is exhausted.
 */
export async function resilientJSON(
  prompt: string,
  maxOutputTokens = 512,
  thinkingBudget = 0
): Promise<string> {
  try {
    return await geminiJSON(prompt, maxOutputTokens, thinkingBudget);
  } catch (e) {
    console.warn(
      "resilientJSON: Gemini failed, falling back to OpenRouter:",
      e instanceof Error ? e.message : String(e)
    );
    return openrouterJSON(prompt, Math.min(Math.max(maxOutputTokens, 512), 4000));
  }
}

/** Dispatch a work prompt to the chosen agent's model. */
export async function callAgent(
  agent: Agent,
  system: string,
  user: string
): Promise<string> {
  return agent.kind === "gemini"
    ? geminiText(system, user)
    : openrouterText(agent.model, system, user);
}
