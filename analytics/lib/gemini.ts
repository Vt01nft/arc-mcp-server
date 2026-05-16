// Minimal Google Gemini REST client (no SDK dependency). Forces JSON output.
// Throws Error with a numeric `.status` on failure so callers can surface a
// clean 503 (provider issue) rather than a generic 500.

const MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

export const GEMINI_MODEL = MODEL;

export async function geminiJSON(
  prompt: string,
  maxOutputTokens = 256
): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    const e = new Error("GEMINI_API_KEY is not set") as Error & {
      status?: number;
    };
    e.status = 503;
    throw e;
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens,
          temperature: 0.3,
          responseMimeType: "application/json",
          // 2.5 models "think" by default and would spend the whole token
          // budget on reasoning, returning no text. Disable it.
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    }
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const e = new Error(
      `Gemini ${res.status}: ${body.slice(0, 300)}`
    ) as Error & { status?: number };
    e.status = res.status;
    throw e;
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string" || !text) {
    throw new Error("Gemini returned no text");
  }
  return text;
}
