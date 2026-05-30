// Manual jury-bridge recovery. Use when the runner errored mid-flight and
// a resolved jury didn't get bridged to ERC-8183.
//
// Run from job-board/:
//   JOBID=<id> [URL=https://arc-job-board.vercel.app] node scripts/jury-bridge.mjs
//
// Reads RUNNER_TOKEN from .env.local so the gated route accepts the call;
// the token is never echoed. Optionally use JOBID=N and URL=... to target
// either the local dev server or production.
import { readFileSync } from "node:fs";

function envFromFile(path) {
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^['"]|['"]\s*$/g, "").trim();
  }
  return out;
}

const jobId = process.env.JOBID;
if (!jobId) {
  console.error("Set JOBID=<chain job id>");
  process.exit(2);
}
const base = process.env.URL ?? "http://localhost:3000";
const env = envFromFile(new URL("../.env.local", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const token = env.RUNNER_TOKEN;
if (!token) {
  console.error("RUNNER_TOKEN missing in .env.local");
  process.exit(2);
}

const res = await fetch(`${base}/api/jury/bridge`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-runner-token": token,
  },
  body: JSON.stringify({ jobId: Number(jobId) }),
});
const body = await res.json();
console.log("status:", res.status);
console.log(JSON.stringify(body, null, 2));
process.exit(res.ok ? 0 : 1);
