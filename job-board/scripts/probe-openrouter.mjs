// Probe each OpenRouter-backed agent model: status + short body. No key echo.
import { readFileSync } from "node:fs";

function envFromFile(path) {
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^['"]|['"]\s*$/g, "").trim();
  }
  return out;
}
const env = envFromFile(new URL("../.env.local", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const key = env.OPENROUTER_KEY;

const models = [
  "xiaomi/mimo-7b-rl",
  "meta-llama/llama-3.3-70b-instruct:free",
  "moonshotai/kimi-k2:free",
  "anthropic/claude-3.5-sonnet",
  "openai/gpt-4o-mini",
];

for (const model of models) {
  try {
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
        max_tokens: 64,
        temperature: 0.2,
        messages: [
          { role: "system", content: "Reply with one short sentence." },
          { role: "user", content: "Say the word ready and nothing else." },
        ],
      }),
    });
    const txt = await res.text();
    let summary = txt.slice(0, 220);
    try {
      const j = JSON.parse(txt);
      summary = j?.choices?.[0]?.message?.content
        ? `OK content="${j.choices[0].message.content.slice(0, 60)}"`
        : JSON.stringify(j?.error ?? j).slice(0, 220);
    } catch {}
    console.log(`${res.status}  ${model}\n      ${summary}\n`);
  } catch (e) {
    console.log(`ERR  ${model}\n      ${e?.message}\n`);
  }
}
