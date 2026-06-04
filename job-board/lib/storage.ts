// Supabase Storage helper for the Phase C hosted-delivery bundle.
// Service-role on the server (uploads, deletes), anon-public on read so the
// job page iframe can load files directly from the storage URL without
// minting a signed URL per request.
import { getServiceClient } from "./supabase";
import { manifestUrl } from "./bundle";

const BUCKET = "deliverables";

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
  xml: "application/xml; charset=utf-8",
  csv: "text/csv; charset=utf-8",
};

function contentTypeFor(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return CONTENT_TYPE[ext] ?? "application/octet-stream";
}

/**
 * Upload one file under `deliverables/<jobId>/<path>`. Idempotent: an
 * existing object at the same key is overwritten so a resubmit of the
 * same job replaces the bundle cleanly.
 */
export async function uploadBundleFile(
  jobId: number,
  path: string,
  content: string
): Promise<string> {
  const db = getServiceClient();
  const key = `${jobId}/${path}`;
  // NOTE: Supabase serves public-bucket HTML as text/plain + nosniff regardless
  // of the upload content-type (anti-XSS on their domain), so we do NOT rely on
  // it for rendering. The job page previews via /api/preview/<jobId>/<path>,
  // which re-serves with the right Content-Type behind a CSP sandbox.
  const { error } = await db.storage
    .from(BUCKET)
    .upload(key, content, {
      contentType: contentTypeFor(path),
      upsert: true,
      cacheControl: "public, max-age=300",
    });
  if (error) {
    throw new Error(`storage upload failed for ${key}: ${error.message}`);
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return manifestUrl(supabaseUrl, jobId, path);
}

/** Remove every file under `deliverables/<jobId>/` (used on re-submit). */
export async function clearBundle(jobId: number): Promise<void> {
  const db = getServiceClient();
  const prefix = String(jobId);
  const { data, error: listErr } = await db.storage
    .from(BUCKET)
    .list(prefix, { limit: 100 });
  if (listErr || !data || data.length === 0) return;
  const paths = data.map((d) => `${prefix}/${d.name}`);
  await db.storage.from(BUCKET).remove(paths);
}

export function publicUrl(jobId: number | string, path: string): string {
  return manifestUrl(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    jobId,
    path
  );
}
