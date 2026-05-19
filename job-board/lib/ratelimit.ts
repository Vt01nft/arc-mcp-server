import { NextRequest, NextResponse } from "next/server";

// Lightweight in-memory sliding-window limiter. Zero dependencies and zero
// added latency. On serverless each instance keeps its own window, so this
// is a strong burst guard, not a global quota; for a hard global limit move
// this to Upstash/Redis. It exists so the unauthenticated model and
// chain-writing endpoints cannot be trivially drained for cost.

type Hit = { count: number; resetAt: number };
const buckets = new Map<string, Hit>();

export function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Returns a 429 NextResponse if the caller exceeded `limit` requests within
 * `windowMs` for `bucket`, otherwise null (allowed).
 */
export function rateLimit(
  req: NextRequest,
  bucket: string,
  limit: number,
  windowMs: number
): NextResponse | null {
  const key = `${bucket}:${clientIp(req)}`;
  const now = Date.now();
  const hit = buckets.get(key);

  if (!hit || now >= hit.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }
  if (hit.count >= limit) {
    const retry = Math.ceil((hit.resetAt - now) / 1000);
    return NextResponse.json(
      { error: `Rate limit exceeded. Try again in ${retry}s.` },
      { status: 429, headers: { "Retry-After": String(retry) } }
    );
  }
  hit.count += 1;
  // Opportunistic cleanup so the map cannot grow unbounded.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (now >= v.resetAt) buckets.delete(k);
  }
  return null;
}
