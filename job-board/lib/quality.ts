// Deterministic pre-submit quality gate for builds. The AI self-verify only
// reliably catches "too short"; this catches the concrete failure modes that
// shipped broken dApps (wrong ethers API, write on a read-only provider,
// invented ABIs, placeholders, truncation) BEFORE the work goes on-chain and
// wastes a jury round. Returns the issues; the runner redoes once if any are
// hard failures.
export type QualityIssue = { rule: string; detail: string; hard: boolean };

export type LintOpts = { defi: boolean; chainish: boolean };

// Pull the HTML portion out of a possibly multi-file `=== path ===` bundle so
// the regexes target the real markup, not a README.
function entryHtml(deliverable: string): string {
  const marker = /^===\s*(.+?)\s*===\s*$/gm;
  const parts: { path: string; start: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = marker.exec(deliverable))) parts.push({ path: m[1], start: m.index });
  if (parts.length === 0) return deliverable; // single file
  for (let i = 0; i < parts.length; i++) {
    if (/\.html?$/i.test(parts[i].path)) {
      const end = i + 1 < parts.length ? parts[i + 1].start : deliverable.length;
      return deliverable.slice(parts[i].start, end);
    }
  }
  return deliverable;
}

export function lintBuild(deliverable: string, opts: LintOpts): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const html = entryHtml(deliverable);
  const isHtml = /<html[\s>]|<!doctype html/i.test(deliverable);
  const add = (rule: string, detail: string, hard = true) =>
    issues.push({ rule, detail, hard });

  // Truncation: an HTML deliverable must close.
  if (isHtml && !/<\/html>\s*$/i.test(deliverable.trim())) {
    add("truncated", "Output is cut off; an HTML deliverable must end with </html>.");
  }

  // Placeholder / unfinished content.
  if (/\b(lorem ipsum|todo|fixme|coming soon|your[_ ]?address[_ ]?here|0x123\.\.\.|placeholder text|feature one|feature two)\b/i.test(deliverable)) {
    add("placeholder", "Contains placeholder/TODO/lorem-ipsum content; deliver finished, specific work.");
  }

  // Too thin for a real app/site.
  if (isHtml && deliverable.length < 3500) {
    add("too-thin", `Only ${deliverable.length} chars; too thin for a real app. Build out real sections, content, and logic.`);
  }

  // Chain/dApp-specific wiring footguns.
  const loadsEthers = /ethers/i.test(html);
  if (loadsEthers || opts.chainish) {
    if (/ethers\.utils\.|ethers\.providers\./.test(html)) {
      add("ethers-v5-api", "Uses ethers v5 API (ethers.utils.* / ethers.providers.*) which throws on the v6 library. Use ethers.formatUnits / ethers.parseUnits / ethers.BrowserProvider / ethers.JsonRpcProvider directly.");
    }
    // A write contract method bound to a read-only provider with no signer.
    const hasJsonRpc = /JsonRpcProvider/.test(html);
    const hasSigner = /BrowserProvider|getSigner/.test(html);
    const looksLikeWrite = /\.(stake|unstake|swap|deposit|withdraw|mint|approve|transfer|claim|borrow|repay|provideLiquidity|addLiquidity)\s*\(/i.test(html);
    if (looksLikeWrite && hasJsonRpc && !hasSigner) {
      add("write-on-read-provider", "Calls a state-changing method but never creates a signer. Writes need: const signer = await new ethers.BrowserProvider(window.ethereum).getSigner(); new ethers.Contract(addr, abi, signer).");
    }
  }

  if (opts.defi) {
    const movesUsdc = /\.(stake|swap|deposit|transfer|approve)\s*\(/i.test(html) || /usdc/i.test(html);
    if (movesUsdc && !/parseUnits/.test(html)) {
      add("usdc-decimals", "Sends USDC without ethers.parseUnits(amount, 6); raw amounts are wrong by 1e6.", false);
    }
    if (/\.(stake|swap|deposit)\s*\(/i.test(html) && !/approve/i.test(html) && !/demo/i.test(html)) {
      add("no-approve", "A DeFi action that moves USDC needs an approve-then-act flow (or a clearly labelled demo mode).", false);
    }
    if (!/connect|BrowserProvider|window\.ethereum/i.test(html) && !/demo/i.test(html)) {
      add("no-wallet", "A dApp needs a wallet connection (or a labelled demo mode).", false);
    }
  }

  return issues;
}

// True if any issue is a hard failure worth a redo.
export function hasHardFailures(issues: QualityIssue[]): boolean {
  return issues.some((i) => i.hard);
}

// Compact, model-facing summary of what to fix on the redo.
export function issuesForPrompt(issues: QualityIssue[]): string {
  return issues.map((i) => `- ${i.rule}: ${i.detail}`).join("\n");
}
