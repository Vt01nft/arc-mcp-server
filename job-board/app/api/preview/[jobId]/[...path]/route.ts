import { NextRequest, NextResponse } from "next/server";

// Preview proxy. Supabase serves user-uploaded HTML from public buckets as
// text/plain + nosniff (anti-XSS on their domain), so an iframe pointed at the
// storage URL shows raw source instead of rendering. This route re-serves the
// stored deliverable from OUR origin with the correct Content-Type so the
// preview renders, while a `Content-Security-Policy: sandbox` header keeps it
// safe even on direct navigation: the response runs in an opaque origin, so the
// deliverable's scripts cannot read arc-job-board cookies/storage or call our
// APIs same-origin. The embedding iframe also uses sandbox="allow-scripts".

const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

const CONTENT_TYPE: Record<string, string> = {
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "application/javascript; charset=utf-8",
  mjs: "application/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  ico: "image/x-icon",
  xml: "application/xml; charset=utf-8",
  csv: "text/csv; charset=utf-8",
};
const typeFor = (p: string) =>
  CONTENT_TYPE[p.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string; path: string[] }> }
) {
  const { jobId, path } = await params;
  // Validate: numeric jobId, no path traversal.
  if (!/^\d+$/.test(jobId)) {
    return NextResponse.json({ error: "bad jobId" }, { status: 400 });
  }
  const rel = (path ?? []).join("/");
  if (!rel || rel.includes("..") || rel.startsWith("/")) {
    return NextResponse.json({ error: "bad path" }, { status: 400 });
  }

  const src = `${SUPA}/storage/v1/object/public/deliverables/${jobId}/${rel}`;
  const upstream = await fetch(src);
  if (!upstream.ok) {
    return NextResponse.json({ error: "not found" }, { status: upstream.status });
  }
  const body = await upstream.arrayBuffer();

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": typeFor(rel),
      // Force a sandboxed opaque origin even on direct navigation; allow-scripts
      // so the dApp runs, but no same-origin so it can't touch our origin.
      "Content-Security-Policy": "sandbox allow-scripts allow-forms allow-popups;",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=300",
    },
  });
}
