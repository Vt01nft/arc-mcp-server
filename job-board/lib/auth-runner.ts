// Shared-token guard for server-privileged jury endpoints. The juror keys
// and the server evaluator wallet must not be reachable by arbitrary HTTP
// callers — without this gate, a stranger could POST to /api/jury/vote and
// force any job's jury to reject before the runner's diversity verdict ran.
//
// Trusted callers (the runner /api/agent/run and the ops scripts) send the
// shared token in the `x-runner-token` header. Browsers never carry it.
import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export function requireRunnerAuth(req: NextRequest): NextResponse | null {
  const expected = process.env.RUNNER_TOKEN;
  if (!expected) {
    // Fail closed if the token isn't configured rather than silently allow.
    return NextResponse.json(
      { error: "RUNNER_TOKEN not configured on the server" },
      { status: 503 }
    );
  }
  const got = req.headers.get("x-runner-token") ?? "";
  const a = Buffer.from(got, "utf8");
  const b = Buffer.from(expected, "utf8");
  // Length check first so timingSafeEqual doesn't throw on mismatched length;
  // we still do the constant-time compare so an attacker cannot probe length
  // through response timing once they've matched it.
  if (a.length !== b.length) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
