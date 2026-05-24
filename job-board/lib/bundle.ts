// Parse an agent's raw output into a sanitized, mainnet-safe multi-file
// bundle. Agents already use the `=== path ===` marker convention. A
// single-file output (no markers) is normalized into a one-file bundle.
//
// The canonical manifest is what we hash on-chain, so it must be
// deterministic: paths sorted, content stored verbatim, version pinned.
//
// Hard limits prevent a runaway model from bricking the storage layer:
//   - MAX_FILES files per bundle
//   - MAX_TOTAL_BYTES across all files (Supabase bucket has its own 5MB cap)
//   - MAX_PATH path length
//   - paths sanitized: relative, no `..`, no `\\`, restricted charset
import { keccak256, toBytes } from "viem";

export type BundleFile = { path: string; content: string };

export type Bundle = {
  files: BundleFile[];
  entry: string;
  /** keccak256 of the canonical manifest, submitted on-chain. */
  hash: `0x${string}`;
  /** Total size of all file contents in UTF-8 bytes. */
  size: number;
};

export const MAX_FILES = 50;
export const MAX_TOTAL_BYTES = 4_500_000; // < 5 MB Supabase bucket cap
export const MAX_PATH = 200;
const PATH_RE = /^[A-Za-z0-9._/-]+$/;

function looksHtml(s: string): boolean {
  const t = s.trim();
  return (
    /^<!doctype html/i.test(t) ||
    /<html[\s>][\s\S]*<\/html>/i.test(t) ||
    (/<body[\s>]/i.test(t) && /<\/body>/i.test(t))
  );
}

/** Strip a leading `=== single-file ===` marker + markdown code fences. */
function unwrap(raw: string): string {
  const markers = raw.match(/^[ \t]*===[^\n]+===[ \t]*$/gm) || [];
  if (markers.length > 1) return raw.trim();
  let c = raw.trim().replace(/^[ \t]*===[^\n]+===[ \t]*\n/, "").trim();
  const fenced = c.match(/^```[a-zA-Z0-9]*\n([\s\S]*?)\n```$/);
  if (fenced) return fenced[1].trim();
  return c.replace(/^```[a-zA-Z0-9]*[ \t]*$/gm, "").trim();
}

function sanitizePath(raw: string): string | null {
  let p = raw.trim().replace(/\\/g, "/");
  // Strip leading "./" and any leading slashes (force relative).
  while (p.startsWith("./")) p = p.slice(2);
  while (p.startsWith("/")) p = p.slice(1);
  if (!p) return null;
  if (p.length > MAX_PATH) return null;
  if (p.split("/").some((seg) => seg === "" || seg === "..")) return null;
  if (!PATH_RE.test(p)) return null;
  return p;
}

function inferEntry(files: BundleFile[]): string {
  const has = (name: string) => files.find((f) => f.path === name);
  if (has("index.html")) return "index.html";
  const anyHtml = files.find((f) => f.path.endsWith(".html"));
  if (anyHtml) return anyHtml.path;
  return files[0]?.path ?? "";
}

function canonicalManifest(files: BundleFile[], entry: string): string {
  // Stable JSON: keys sorted, files sorted by path. Recomputable by any
  // verifier from the public storage URLs.
  const sortedFiles = [...files].sort((a, b) =>
    a.path < b.path ? -1 : a.path > b.path ? 1 : 0
  );
  return JSON.stringify({
    v: 1,
    entry,
    files: sortedFiles.map((f) => ({ path: f.path, content: f.content })),
  });
}

export function parseBundle(raw: string): Bundle {
  if (typeof raw !== "string" || raw.length === 0) {
    throw new Error("bundle: empty agent output");
  }

  // Find all `=== path ===` markers and the spans between them.
  const markerRe = /^[ \t]*===[ \t]*([^\n=]+?)[ \t]*===[ \t]*$/gm;
  const matches: { path: string; start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = markerRe.exec(raw)) !== null) {
    matches.push({ path: m[1], start: m.index, end: markerRe.lastIndex });
  }

  let files: BundleFile[] = [];
  if (matches.length === 0) {
    // Single-file output: unwrap markdown fences, give it a sane filename.
    const content = unwrap(raw);
    const path = looksHtml(content) ? "index.html" : "deliverable.md";
    files = [{ path, content }];
  } else {
    for (let i = 0; i < matches.length; i++) {
      const rawPath = matches[i].path;
      const startOfContent =
        raw.indexOf("\n", matches[i].end) + 1 || matches[i].end;
      const endOfContent =
        i + 1 < matches.length ? matches[i + 1].start : raw.length;
      let content = raw.slice(startOfContent, endOfContent);
      // Strip any markdown code fence wrapping this section's content.
      const fenced = content
        .trim()
        .match(/^```[a-zA-Z0-9]*\n([\s\S]*?)\n```\s*$/);
      if (fenced) content = fenced[1];
      const sanitized = sanitizePath(rawPath);
      if (!sanitized) continue; // drop unsafe path entries
      // Dedupe: last wins (model sometimes repeats a file).
      const existing = files.findIndex((f) => f.path === sanitized);
      if (existing >= 0) files[existing] = { path: sanitized, content };
      else files.push({ path: sanitized, content });
    }
    if (files.length === 0) {
      // Markers were present but all paths were rejected; fall back to
      // treating the whole output as a single file rather than throwing.
      const content = unwrap(raw);
      const path = looksHtml(content) ? "index.html" : "deliverable.md";
      files = [{ path, content }];
    }
  }

  if (files.length > MAX_FILES) {
    throw new Error(`bundle: too many files (${files.length} > ${MAX_FILES})`);
  }
  const size = files.reduce(
    (n, f) => n + Buffer.byteLength(f.content, "utf8"),
    0
  );
  if (size > MAX_TOTAL_BYTES) {
    throw new Error(
      `bundle: total size ${size} > ${MAX_TOTAL_BYTES} bytes`
    );
  }

  const entry = inferEntry(files);
  const manifest = canonicalManifest(files, entry);
  const hash = keccak256(toBytes(manifest));

  return { files, entry, hash, size };
}

export function manifestUrl(
  supabaseUrl: string,
  jobId: number | string,
  path: string
): string {
  return `${supabaseUrl}/storage/v1/object/public/deliverables/${jobId}/${path}`;
}
