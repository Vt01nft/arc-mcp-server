import { NextRequest, NextResponse } from "next/server";
import { keccak256, toBytes, parseUnits } from "viem";
import {
  publicClient,
  getWalletClient,
  getSignerFromEnv,
  getFaucetWalletClient,
} from "@/lib/viem";
import { getServiceClient } from "@/lib/supabase";
import { ADDRESSES } from "@/contracts/addresses";
import { ERC8183_ABI } from "@/contracts/abis";
import {
  agentByWallet,
  AGENT_WALLETS,
  AGENTS,
  GLOBAL_RULES,
  BUILD_SKILL,
  SECURITY_AUDIT_SKILL,
} from "@/lib/agents";
import { callAgent } from "@/lib/ai";
import { geminiJSON } from "@/lib/gemini";

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

async function fetchTarget(desc: string): Promise<string> {
  const m = desc.match(/https?:\/\/[^\s)]+/i);
  if (!m) return "";
  let url = m[0];
  try {
    const gh = url.match(
      /github\.com\/([^/\s]+)\/([^/\s#]+)/i
    );
    if (gh) {
      url = `https://api.github.com/repos/${gh[1]}/${gh[2].replace(
        /\.git$/,
        ""
      )}/readme`;
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
  try {
    const { jobId, clientEmail, amountUsdc } = (await req.json()) as {
      jobId?: number;
      clientEmail?: string;
      amountUsdc?: string;
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
      const vr = await geminiJSON(
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
      if (v.complete === false || (typeof v.score === "number" && v.score < 0.7)) {
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

    // 3) Submit on-chain from the agent's own wallet.
    const signer = getSignerFromEnv(agent.pkEnv);
    const submitHash = await signer.writeContract({
      address: ADDRESSES.ERC8183_JOB,
      abi: ERC8183_ABI,
      functionName: "submit",
      args: [BigInt(jobId), keccak256(toBytes(deliverable)), "0x"],
    });
    await publicClient.waitForTransactionReceipt({ hash: submitHash });

    // 4) Persist the readable deliverable.
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
        deliverable_hash: keccak256(toBytes(deliverable)),
        content_preview: deliverable.slice(0, 200000),
        ipfs_cid: null,
      });
    }

    // 5) Gemini evaluation (advisory).
    let decision: "approve" | "reject" = "reject";
    let reasoningText = "Evaluator could not assess the deliverable.";
    try {
      const er = await geminiJSON(
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
      decision = e.decision === "approve" ? "approve" : "reject";
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

    // 6) Evaluator wallet settles on-chain: release or refund.
    const evalWallet = getWalletClient();
    const settleHash = await evalWallet.writeContract({
      address: ADDRESSES.ERC8183_JOB,
      abi: ERC8183_ABI,
      functionName: decision === "approve" ? "complete" : "reject",
      args: [
        BigInt(jobId),
        reason(decision === "approve" ? "agent work approved" : "did not pass review"),
        "0x",
      ],
    });
    await publicClient.waitForTransactionReceipt({ hash: settleHash });

    // 6b) Pay the agent the bounty from the project pool on approval.
    // (Agent jobs are not client-funded ERC-8183 escrow because the contract
    // requires the client to sign fund(); the pool settles the real payout.)
    let payoutTx: string | null = null;
    const amt = Number(amountUsdc ?? "0");
    if (decision === "approve" && amt > 0) {
      try {
        const pool = getFaucetWalletClient();
        const bal = await publicClient.getBalance({
          address: pool.account.address,
        });
        const value = parseUnits(String(amt), 18);
        if (bal >= value) {
          payoutTx = await pool.sendTransaction({
            to: AGENT_WALLETS[agent.id] as `0x${string}`,
            value,
          });
        }
      } catch {
        /* payout best-effort; on-chain lifecycle already settled */
      }
    }

    // 7) Notify the poster (in-app always; email best-effort).
    const msg =
      decision === "approve"
        ? `Job #${jobId} completed by ${agent.name}. USDC released.`
        : `Job #${jobId} was rejected on review by ${agent.name}. USDC refunded.`;
    try {
      await db.from("notifications").insert({
        client_address: job.client.toLowerCase(),
        client_email: clientEmail ?? null,
        chain_job_id: jobId,
        kind: decision === "approve" ? "completed" : "rejected",
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
            subject: `Your job #${jobId} is ${decision === "approve" ? "done" : "closed"}`,
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
      decision,
      submitTx: submitHash,
      settleTx: settleHash,
      payoutTx,
    });
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    console.error("agent/run error:", m);
    return NextResponse.json({ ok: false, error: m }, { status: 500 });
  }
}
