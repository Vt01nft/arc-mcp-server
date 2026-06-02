import { NextRequest, NextResponse } from "next/server";
import { keccak256, toBytes } from "viem";
import {
  publicClient,
  getWalletClient,
  getSignerFromEnv,
} from "@/lib/viem";
import { getServiceClient } from "@/lib/supabase";
import { ADDRESSES } from "@/contracts/addresses";
import { ERC8183_ABI } from "@/contracts/abis";
import {
  agentByWallet,
  agentErc8004Id,
  AGENTS,
  GLOBAL_RULES,
  BUILD_SKILL,
  SECURITY_AUDIT_SKILL,
} from "@/lib/agents";
import { giveAgentFeedback } from "@/lib/reputation";
import { callAgent, resilientJSON } from "@/lib/ai";
import { rateLimit } from "@/lib/ratelimit";
import { parseBundle } from "@/lib/bundle";
import { clearBundle, uploadBundleFile } from "@/lib/storage";
import {
  isJuryHook,
  seatJuryFor,
  jurorEvaluate,
  castVoteSafe,
  bridgeToErc8183,
  getJury,
  slotForMember,
  JUROR_SLOTS,
} from "@/lib/jury";

export const maxDuration = 300;

type Job = {
  id: bigint;
  client: string;
  provider: string;
  evaluator: string;
  description: string;
  budget: bigint;
  expiredAt: bigint;
  status: number;
  hook: string;
};

const reason = (s: string) => keccak256(toBytes(s.slice(0, 200)));

// Reject URLs that point at internal/private/cloud-metadata services so a
// brief cannot be used to coerce the function into fetching IMDS or
// neighbouring containers. We only allow public http/https hostnames; IP
// literals in private/loopback/link-local ranges and *.internal / *.local
// hostnames are blocked. No DNS rebinding protection here; for testnet
// audit this is acceptable, document for prod.
function isSafeUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "metadata.google.internal" ||
    host === "instance-data"
  ) {
    return false;
  }
  // Block IPv4 literals in private / loopback / link-local / multicast ranges.
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const o = v4.slice(1).map(Number);
    if (o.some((n) => n > 255)) return false;
    const [a, b] = o;
    if (a === 10) return false;
    if (a === 127) return false;
    if (a === 0) return false;
    if (a === 169 && b === 254) return false; // link-local incl IMDS
    if (a === 192 && b === 168) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a >= 224) return false; // multicast + reserved
    return true;
  }
  // Block obvious IPv6 internals; full parsing isn't worth it for testnet.
  if (host.startsWith("[")) {
    const inner = host.slice(1, -1);
    if (inner === "::1") return false;
    if (inner.startsWith("fc") || inner.startsWith("fd")) return false; // ULA
    if (inner.startsWith("fe80")) return false; // link-local
  }
  return true;
}

async function fetchTarget(desc: string): Promise<string> {
  const m = desc.match(/https?:\/\/[^\s)]+/i);
  if (!m) return "";
  let url = m[0];
  if (!isSafeUrl(url)) return "";
  try {
    const gh = url.match(
      /github\.com\/([^/\s]+)\/([^/\s#]+)/i
    );
    if (gh) {
      url = `https://api.github.com/repos/${gh[1]}/${gh[2].replace(
        /\.git$/,
        ""
      )}/readme`;
      if (!isSafeUrl(url)) return "";
      const r = await fetch(url, {
        headers: { Accept: "application/vnd.github.raw" },
      });
      if (r.ok) return `\n\n[Target ${m[0]} README]\n` + (await r.text()).slice(0, 12000);
    }
    const r = await fetch(url);
    if (r.ok) return `\n\n[Target ${url} content]\n` + (await r.text()).slice(0, 12000);
  } catch {
    /* best effort */
  }
  return "";
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, "agent-run", 12, 60_000);
  if (limited) return limited;
  try {
    const { jobId, clientEmail, amountUsdc, useJury } = (await req.json()) as {
      jobId?: number;
      clientEmail?: string;
      amountUsdc?: string;
      useJury?: boolean;
    };
    if (jobId == null || !Number.isInteger(jobId)) {
      return NextResponse.json({ error: "jobId required" }, { status: 400 });
    }

    const job = (await publicClient.readContract({
      address: ADDRESSES.ERC8183_JOB,
      abi: ERC8183_ABI,
      functionName: "getJob",
      args: [BigInt(jobId)],
    })) as Job;

    if (job.id === 0n) {
      return NextResponse.json({ error: "job not found" }, { status: 404 });
    }
    const agent = agentByWallet(job.provider);
    if (!agent) {
      return NextResponse.json({
        ok: false,
        message: "Provider is not one of the agent wallets; nothing to run.",
      });
    }
    // submit() is valid for Funded (1) or Open with no budget (0). Agent jobs
    // are typically Open/budget 0 (client cannot fund an agent's escrow).
    // Anything past that means it was already handled (idempotent).
    if (Number(job.status) !== 0 && Number(job.status) !== 1) {
      return NextResponse.json({
        ok: false,
        message: `Job status is ${job.status}, already handled.`,
      });
    }

    const isAudit =
      /audit|vulnerab|security review/i.test(job.description) ||
      job.description.length < 4000;
    const wantsAudit = /audit|vulnerab|security/i.test(job.description);
    const skill = wantsAudit ? SECURITY_AUDIT_SKILL : BUILD_SKILL;
    const target = wantsAudit || /https?:\/\//i.test(job.description)
      ? await fetchTarget(job.description)
      : "";

    const system = `${GLOBAL_RULES}\n\n${skill}`;
    const userPrompt = `Job brief:\n${job.description}${target}\n\nDeliver the complete work now.`;

    // 1) Do the work. Fall back to Gemini if the chosen model errors.
    let deliverable = "";
    let usedModel = agent.name;
    try {
      deliverable = await callAgent(agent, system, userPrompt);
    } catch {
      const g = AGENTS.find((a) => a.id === "gemini")!;
      deliverable = await callAgent(g, system, userPrompt);
      usedModel = `${agent.name} unavailable, Gemini fallback`;
    }

    // 2) Self-verify, one redo if weak.
    try {
      const vr = await resilientJSON(
        `Score this deliverable for the brief. JSON {"complete":bool,"score":0..1,"issues":"..."}.\nBrief:\n${job.description.slice(
          0,
          2000
        )}\nDeliverable:\n${deliverable.slice(0, 120000)}`,
        256
      );
      const v = JSON.parse(vr.match(/\{[\s\S]*\}/)?.[0] ?? "{}") as {
        complete?: boolean;
        score?: number;
        issues?: string;
      };
      // Only spend a second full generation when the output is both weak
      // and short. A large deliverable redo is the main cause of the
      // function timing out; the evaluator is the real quality gate.
      if (
        deliverable.length < 6000 &&
        (v.complete === false ||
          (typeof v.score === "number" && v.score < 0.7))
      ) {
        deliverable = await callAgent(
          agent,
          system,
          `${userPrompt}\n\nYour previous attempt had issues: ${
            v.issues ?? "incomplete"
          }. Redo it completely and fix them.`
        ).catch(() => deliverable);
      }
    } catch {
      /* verify is best-effort */
    }

    const db = getServiceClient();

    // 3) Phase C: parse the agent output into a sanitized multi-file bundle,
    //    upload every file to Supabase Storage, and submit the canonical
    //    manifest hash on-chain. Single-file outputs still parse into a
    //    one-file bundle, so the same code path covers both shapes.
    const bundle = parseBundle(deliverable);
    await clearBundle(jobId); // wipe any prior bundle on re-submit
    await Promise.all(
      bundle.files.map((f) => uploadBundleFile(jobId, f.path, f.content))
    );

    // 4) Submit on-chain from the agent's own wallet, committing to the
    //    canonical manifest hash (recomputable from the public storage URLs).
    const signer = getSignerFromEnv(agent.pkEnv);
    const submitHash = await signer.writeContract({
      address: ADDRESSES.ERC8183_JOB,
      abi: ERC8183_ABI,
      functionName: "submit",
      args: [BigInt(jobId), bundle.hash, "0x"],
    });
    await publicClient.waitForTransactionReceipt({ hash: submitHash });

    // 5) Persist a compact manifest pointer in `content_preview` so the job
    //    page can detect a bundle without a schema change. File contents
    //    themselves live in Storage at the public URLs.
    const manifestPointer = JSON.stringify({
      v: 1,
      bundle: true,
      entry: bundle.entry,
      files: bundle.files.map((f) => f.path),
      size: bundle.size,
    });
    const { data: jobRow } = await db
      .from("jobs")
      .select("id")
      .eq("chain_job_id", jobId)
      .maybeSingle();
    if (jobRow) {
      await db.from("deliverables").delete().eq("chain_job_id", jobId);
      await db.from("deliverables").insert({
        job_id: jobRow.id,
        chain_job_id: jobId,
        deliverable_hash: bundle.hash,
        content_preview: manifestPointer,
        ipfs_cid: null,
      });
    }

    // 6) Evaluation + settlement. Two paths:
    //    (a) jury path — job.hook == MULTI_EVALUATOR_HOOK: seat 3-juror jury,
    //        each juror evaluates independently with a different model, three
    //        votes are cast on-chain from EVALUATOR_PK_1/2/3, then the server
    //        bridges the 2-of-3 outcome to ERC-8183 complete/reject.
    //    (b) single-evaluator path — the legacy auto-loop (unchanged).
    let decision: "approve" | "reject" = "reject";
    let evaluated = false;
    let reasoningText = "Evaluator could not assess the deliverable.";
    let settleHash: `0x${string}` | null = null;
    let juryInfo: {
      seatTx: string;
      voteTxs: (string | null)[];
      voteSkips: (string | undefined)[];
      verdicts: { slot: number; model: string; approve: boolean; confidence: number }[];
      resolved: boolean;
      approves: number;
      rejects: number;
    } | null = null;

    // Jury path triggers off two signals: an explicit useJury flag in the
    // POST body (the /post checkbox path), or the hook field on the job
    // pointing at MULTI_EVALUATOR_HOOK (only possible if Arc later whitelists
    // it; today the AgenticCommerce hook whitelist rejects ours, so the body
    // flag is the practical trigger).
    if (useJury === true || isJuryHook(job.hook)) {
      // (a) JURY PATH
      try {
        const seatTx = await seatJuryFor(BigInt(jobId), job.budget);
        // selectJury draws 3 at random from the whole active pool, which may
        // now include human evaluators. Only vote for the slots WE own
        // (project AI jurors); human members vote for themselves on the /jury
        // page. Map the drawn members to our slots by address.
        const seated = await getJury(BigInt(jobId));
        const aiSlots = seated.members
          .map((m) => slotForMember(m))
          .filter((s): s is (typeof JUROR_SLOTS)[number] => s !== null);
        const humanCount = 3 - aiSlots.length;

        const verdicts = await Promise.all(
          aiSlots.map((slot) =>
            jurorEvaluate(slot, job.description, deliverable)
          )
        );
        // Cast votes sequentially so we don't race the on-chain _resolve
        // trigger. castVoteSafe swallows idempotent reverts after _resolve.
        const voteTxs: (`0x${string}` | null)[] = [];
        const voteSkips: (string | undefined)[] = [];
        for (const v of verdicts) {
          const r = await castVoteSafe(v.slot, BigInt(jobId), v.approve);
          voteTxs.push(r.tx);
          voteSkips.push(r.skipped);
        }
        const finalJury = await getJury(BigInt(jobId));
        const approved = finalJury.approves > finalJury.rejects;
        decision = approved ? "approve" : "reject";
        evaluated = finalJury.resolved;
        reasoningText = `Jury ${approved ? "approved" : "rejected"} ${
          approved ? finalJury.approves : finalJury.rejects
        }-${approved ? finalJury.rejects : finalJury.approves}: ${
          verdicts.map((v) => `${v.modelLabel.split(":").pop()}=${v.approve ? "Y" : "N"}`).join(", ")
        }${humanCount > 0 ? ` (+${humanCount} human juror${humanCount > 1 ? "s" : ""} pending)` : ""}`;

        if (finalJury.resolved && jobRow) {
          // Persist one row per AI juror so the job page can show real diversity.
          await Promise.all(
            verdicts.map((v) =>
              db.from("evaluations").insert({
                job_id: jobRow.id,
                chain_job_id: jobId,
                decision: v.approve ? "approve" : "reject",
                reasoning: v.reasoning,
                confidence: v.confidence,
                evaluator: `jury#${v.slot} ${v.modelLabel}`,
              })
            )
          );
        }

        // Bridge only once the jury has actually resolved on-chain. With human
        // jurors in the mix the AI votes alone may not reach 2-of-3, so the
        // job stays Submitted until the humans vote and a later /api/jury/bridge
        // (or forceResolve after the window) finalizes it.
        if (finalJury.resolved) {
          const bridged = await bridgeToErc8183(
            BigInt(jobId),
            approved,
            reasoningText
          );
          settleHash = bridged.tx;
        }

        juryInfo = {
          seatTx,
          voteTxs,
          voteSkips,
          verdicts: verdicts.map((v) => ({
            slot: v.slot,
            model: v.modelLabel,
            approve: v.approve,
            confidence: v.confidence,
          })),
          resolved: finalJury.resolved,
          approves: finalJury.approves,
          rejects: finalJury.rejects,
        };
      } catch (e) {
        // Jury orchestration failed mid-flight. The deliverable is already
        // on-chain; /jury/[jobId] + /api/jury/{seat,vote,bridge} can finish
        // the job manually, so don't auto-reject or refund here.
        console.error("jury orchestration error:", (e as Error).message);
      }
    } else {
      // (b) SINGLE-EVALUATOR PATH (legacy auto-loop, unchanged behavior)
      try {
        const er = await resilientJSON(
          `You are the evaluator. Decide if the deliverable satisfies the brief. Strict but fair. JSON {"decision":"approve"|"reject","reasoning":"2-4 sentences","confidence":0..1}.\nBrief:\n${job.description.slice(
            0,
            2500
          )}\nDeliverable:\n${deliverable.slice(0, 120000)}`,
          3072,
          1024
        );
        const e = JSON.parse(er.match(/\{[\s\S]*\}/)?.[0] ?? "{}") as {
          decision?: string;
          reasoning?: string;
          confidence?: number;
        };
        if (e.decision === "approve" || e.decision === "reject") {
          decision = e.decision;
          evaluated = true;
        }
        reasoningText = (e.reasoning ?? reasoningText).slice(0, 1000);
        if (jobRow) {
          await db.from("evaluations").insert({
            job_id: jobRow.id,
            chain_job_id: jobId,
            decision,
            reasoning: reasoningText,
            confidence:
              typeof e.confidence === "number"
                ? Math.min(1, Math.max(0, e.confidence))
                : 0,
            evaluator: "gemini-2.5-flash",
          });
        }
      } catch {
        /* default reject if evaluation fails */
      }

      // Evaluator wallet settles only when an explicit decision was produced.
      // If evaluation could not run, leave the job Submitted for a human to
      // review on the job page rather than refunding away completed work.
      if (evaluated) {
        const evalWallet = getWalletClient();
        settleHash = await evalWallet.writeContract({
          address: ADDRESSES.ERC8183_JOB,
          abi: ERC8183_ABI,
          functionName: decision === "approve" ? "complete" : "reject",
          args: [
            BigInt(jobId),
            reason(
              decision === "approve"
                ? "agent work approved"
                : "did not pass review"
            ),
            "0x",
          ],
        });
        await publicClient.waitForTransactionReceipt({ hash: settleHash });
      }
    }

    // 7b) Payout. Real client-funded escrow (budget > 0) releases
    // automatically via complete(). The legacy pool fallback was removed
    // because amountUsdc came from the request body, letting a third
    // party drain the pool wallet by spamming runs for arbitrary amounts.
    const payoutTx: string | null = null;

    // 7c) ERC-8004 reputation. When the job actually settled on-chain
    // (evaluated + settle/bridge tx landed) and the provider agent has a
    // registered agentId, record permissionless feedback for it. Best-effort:
    // a failure here never affects the settlement that already happened.
    let reputationTx: string | null = null;
    const agentId = agentErc8004Id(agent.id);
    if (evaluated && settleHash && agentId != null) {
      const fb = await giveAgentFeedback({
        agentId,
        approved: decision === "approve",
        jobId,
        source: juryInfo ? "jury" : "single-evaluator",
        summary: reasoningText,
      });
      reputationTx = fb.tx;
      if (fb.error) console.warn("ERC-8004 feedback failed:", fb.error);
    }

    // 8) Notify the poster (in-app always; email best-effort). Three
    // outcomes: completed, rejected, or submitted-pending-review.
    const outcome = !evaluated
      ? "pending"
      : decision === "approve"
      ? "completed"
      : "rejected";
    const msg =
      outcome === "completed"
        ? `Job #${jobId} completed by ${agent.name}. USDC released.`
        : outcome === "rejected"
        ? `Job #${jobId} was rejected on review by ${agent.name}. USDC refunded.`
        : `Job #${jobId}: ${agent.name} submitted the work. Automated review did not finish in time, so it is awaiting evaluation on the job page. No funds were moved.`;
    try {
      // client_email is intentionally NOT stored here. The notifications
      // table has a public read policy, so any column we put on it leaks
      // via the Supabase anon endpoint. Email delivery happens directly
      // from the request body (clientEmail), not from a stored copy.
      await db.from("notifications").insert({
        client_address: job.client.toLowerCase(),
        chain_job_id: jobId,
        kind: outcome === "completed" ? "completed" : outcome === "rejected" ? "rejected" : "submitted",
        message: msg,
      });
    } catch {
      /* table optional */
    }
    if (clientEmail && process.env.RESEND_API_KEY) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Arc Job Board <onboarding@resend.dev>",
            to: [clientEmail],
            subject: `Your job #${jobId} is ${
              outcome === "completed"
                ? "done"
                : outcome === "rejected"
                ? "closed"
                : "submitted and awaiting review"
            }`,
            text: `${msg}\n\n${reasoningText}\n\nView: https://arc-job-board.vercel.app/jobs/${jobId}`,
          }),
        });
      } catch {
        /* email best effort */
      }
    }

    return NextResponse.json({
      ok: true,
      agent: agent.name,
      usedModel,
      outcome,
      evaluated,
      decision: evaluated ? decision : null,
      submitTx: submitHash,
      settleTx: settleHash,
      payoutTx,
      reputationTx,
      jury: juryInfo,
    });
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    console.error("agent/run error:", m);
    return NextResponse.json({ ok: false, error: m }, { status: 500 });
  }
}
