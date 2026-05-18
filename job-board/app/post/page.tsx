"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { zeroAddress, decodeEventLog, parseUnits } from "viem";
import { ERC8183_ABI, USDC_ABI } from "@/contracts/abis";
import { ADDRESSES } from "@/contracts/addresses";
import { publicClient } from "@/lib/viem";
import { JOB_CATEGORIES, type JobCategory } from "@/lib/types";
import { useCircle } from "@/components/CircleProvider";

// After a Circle createJob (no receipt), find the new jobId by scanning back
// from jobCounter for the job whose client + description match ours.
async function resolveJobId(
  client: string,
  description: string
): Promise<number | null> {
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const counter = (await publicClient.readContract({
        address: ADDRESSES.ERC8183_JOB,
        abi: ERC8183_ABI,
        functionName: "jobCounter",
      })) as bigint;
      for (let i = 0; i < 30; i++) {
        const id = Number(counter) - i;
        if (id <= 0) break;
        const j = (await publicClient.readContract({
          address: ADDRESSES.ERC8183_JOB,
          abi: ERC8183_ABI,
          functionName: "getJob",
          args: [BigInt(id)],
        })) as { client: string; description: string };
        if (
          j.client?.toLowerCase() === client.toLowerCase() &&
          j.description === description
        ) {
          return id;
        }
      }
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 2500)); // wait for the tx to mine
  }
  return null;
}

const EVALUATOR_ADDRESS = (
  process.env.NEXT_PUBLIC_EVALUATOR_ADDRESS ?? "0x3d1e88e762d8872365c050cde888729aec773eab"
) as `0x${string}`;

export default function PostJobPage() {
  const router = useRouter();
  const { address } = useAccount();
  const circle = useCircle();
  const [form, setForm] = useState({
    description: "",
    category: "General" as JobCategory,
    providerAddress: "",
    amountUsdc: "",
    expiryHours: 72,
    agent: "auto",
  });
  const [agents, setAgents] = useState<
    { id: string; name: string; address: string; available: boolean }[]
  >([]);
  useEffect(() => {
    fetch("/api/agents")
      .then((r) => r.json())
      .then((d) => setAgents(d.agents ?? []))
      .catch(() => setAgents([]));
  }, []);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savedRef = useRef(false);

  const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  useEffect(() => {
    if (!isSuccess || !receipt || savedRef.current) return;
    savedRef.current = true;
    setSaving(true);

    let chainJobId: number | null = null;
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: ERC8183_ABI,
          eventName: "JobCreated",
          topics: log.topics,
          data: log.data,
        }) as { args: { jobId: bigint } };
        chainJobId = Number(decoded.args.jobId);
        break;
      } catch {
        // not a JobCreated log
      }
    }

    fetch("/api/jobs/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chainJobId,
        description: form.description,
        category: form.category,
        clientAddress: address,
        providerAddress: form.providerAddress,
      }),
    })
      .catch(() => {})
      .finally(() => {
        setSaving(false);
        router.push(chainJobId !== null ? `/jobs/${chainJobId}` : "/jobs");
      });
  }, [isSuccess, receipt, address, form, router]);

  // Derive the wallet/tx error message from wagmi's writeError during render
  // instead of mirroring it into state via an effect (avoids cascading renders).
  const writeErrorMsg = useMemo(() => {
    if (!writeError) return null;
    // wagmi errors nest the useful message in shortMessage or cause
    const err = writeError as Error & { shortMessage?: string; cause?: { message?: string } };
    const msg =
      err.shortMessage ||
      err.cause?.message ||
      err.message ||
      String(writeError);
    if (msg.includes("User rejected") || msg.includes("user rejected")) {
      return "Transaction rejected in wallet.";
    }
    if (msg.includes("insufficient funds")) {
      return "Insufficient USDC for gas. Top up this wallet from faucet.circle.com.";
    }
    return msg || "Transaction failed.";
  }, [writeError]);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const isCustom = form.agent === "custom";
    if (!form.description || (isCustom && !form.providerAddress)) {
      setError(
        isCustom
          ? "Description and provider address are required."
          : "Description is required."
      );
      return;
    }
    setError(null);
    savedRef.current = false;

    const expiryTimestamp =
      BigInt(Math.floor(Date.now() / 1000)) + BigInt(form.expiryHours * 3600);

    if (circle.status === "ready") {
      setSaving(true);
      try {
        // Resolve the provider: a chosen agent wallet, Gemini-routed agent,
        // or a custom address you typed.
        let providerAddr = form.providerAddress.trim();
        if (form.agent === "auto") {
          const r = await fetch("/api/route-agent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              description: form.description,
              category: form.category,
            }),
          }).then((x) => x.json());
          providerAddr = r.address;
        } else if (!isCustom) {
          providerAddr =
            agents.find((a) => a.id === form.agent)?.address ?? providerAddr;
        }
        if (!providerAddr) throw new Error("Could not resolve a provider.");

        await circle.execute({
          address: ADDRESSES.ERC8183_JOB,
          abi: ERC8183_ABI,
          functionName: "createJob",
          args: [
            providerAddr as `0x${string}`,
            EVALUATOR_ADDRESS,
            expiryTimestamp,
            form.description,
            zeroAddress,
          ],
        });

        const jobId = await resolveJobId(
          circle.address as string,
          form.description
        );

        // Real client-funded ERC-8183 escrow only works when you are the
        // provider (contract requires provider setBudget + client fund).
        const amount = form.amountUsdc.trim();
        if (
          isCustom &&
          jobId != null &&
          Number(amount) > 0 &&
          circle.address?.toLowerCase() === providerAddr.toLowerCase()
        ) {
          const raw = parseUnits(amount, 6);
          await circle.execute({
            address: ADDRESSES.ERC8183_JOB,
            abi: ERC8183_ABI,
            functionName: "setBudget",
            args: [BigInt(jobId!), raw, "0x"],
          });
          await circle.execute({
            address: ADDRESSES.USDC,
            abi: USDC_ABI,
            functionName: "approve",
            args: [ADDRESSES.ERC8183_JOB, raw],
          });
          await circle.execute({
            address: ADDRESSES.ERC8183_JOB,
            abi: ERC8183_ABI,
            functionName: "fund",
            args: [BigInt(jobId!), "0x"],
          });
        }

        await fetch("/api/jobs/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chainJobId: jobId,
            description: form.description,
            category: form.category,
            clientAddress: circle.address,
            providerAddress: providerAddr,
            clientEmail: circle.email,
            agent: form.agent,
          }),
        }).catch(() => {});

        // Agent job: kick the autonomous runner (fire and forget).
        if (!isCustom && jobId != null) {
          fetch("/api/agent/run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jobId,
              clientEmail: circle.email,
              amountUsdc: amount,
            }),
          }).catch(() => {});
        }

        router.push(jobId != null ? `/jobs/${jobId}` : "/jobs");
      } catch (err) {
        setError((err as Error).message || "Circle transaction failed.");
      } finally {
        setSaving(false);
      }
      return;
    }

    writeContract({
      address: ADDRESSES.ERC8183_JOB,
      abi: ERC8183_ABI,
      functionName: "createJob",
      args: [
        form.providerAddress as `0x${string}`,
        EVALUATOR_ADDRESS,
        expiryTimestamp,
        form.description, // on-chain description is a string, not a hash
        zeroAddress, // no hook (address(0) is whitelisted)
      ],
    });
  }

  const submitting = isPending || isConfirming || saving;

  return (
    <div
      style={{ maxWidth: 640, margin: "0 auto", padding: "48px 0 0" }}
    >
      <div className="kicker">
        <span className="square" />
        Place a Listing
      </div>
      <h1
        className="serif-h"
        style={{ fontSize: 48, margin: "0 0 10px" }}
      >
        Post a Job
      </h1>
      <p
        className="lede"
        style={{ fontSize: 16, marginBottom: 32 }}
      >
        Funds are locked in ERC-8183 escrow the moment the job is created, and
        only released when Gemini approves the deliverable.
      </p>

      {circle.status !== "ready" ? (
        <div
          className="paper-card"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 18,
            padding: "48px 24px",
          }}
        >
          <p className="eyebrow">
            Use “Sign in with Circle” in the header (email + PIN) to post a job
            on Arc. No wallet extension needed.
          </p>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 22 }}
        >
          <div>
            <label className="label">Job Description</label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={4}
              placeholder="Describe the task clearly. Gemini will use this to evaluate the deliverable."
              className="field"
            />
          </div>

          <div>
            <label className="label">Category</label>
            <select
              name="category"
              value={form.category}
              onChange={handleChange}
              className="field"
            >
              {JOB_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Agent</label>
            <select
              name="agent"
              value={form.agent}
              onChange={handleChange}
              className="field"
            >
              <option value="auto">Auto (Gemini picks the best agent)</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id} disabled={!a.available}>
                  {a.name}
                  {a.available ? "" : " (unavailable)"}
                </option>
              ))}
              <option value="custom">Custom address (assign it yourself)</option>
            </select>
            <p
              className="eyebrow"
              style={{ marginTop: 8, textTransform: "none", letterSpacing: 0 }}
            >
              An AI agent does the job autonomously, then Gemini reviews it and
              the evaluator releases the bounty. "Auto" lets Gemini route to the
              best-fit agent. Pick "Custom address" to assign a specific wallet
              (a person, or yourself for testing).
            </p>
          </div>

          {form.agent === "custom" && (
            <div>
              <label className="label">Provider Address</label>
              <input
                type="text"
                name="providerAddress"
                value={form.providerAddress}
                onChange={handleChange}
                placeholder="0x…"
                className="field mono"
              />
              <p
                className="eyebrow"
                style={{
                  marginTop: 8,
                  textTransform: "none",
                  letterSpacing: 0,
                }}
              >
                The wallet that will do this job and receive the USDC when it
                is approved. Paste your own address (shown as “Your address”
                below) to test it yourself.
              </p>
            </div>
          )}

          <div>
            <label className="label">Escrow amount (USDC)</label>
            <input
              type="number"
              name="amountUsdc"
              value={form.amountUsdc}
              onChange={handleChange}
              min={0}
              step="0.01"
              placeholder="e.g. 0.5"
              className="field"
            />
            <p
              className="eyebrow"
              style={{ marginTop: 8, textTransform: "none", letterSpacing: 0 }}
            >
              If you set this and your wallet is also the provider address, the
              USDC is escrowed now (set budget, approve, fund) in one flow.
              Otherwise leave it blank and the provider sets the price, then you
              fund from the job page.
            </p>
          </div>

          <div>
            <label className="label">Expiry (hours)</label>
            <input
              type="number"
              name="expiryHours"
              value={form.expiryHours}
              onChange={handleChange}
              min={1}
              max={720}
              className="field"
            />
          </div>

          {(error || writeErrorMsg) && (
            <div className="notice notice-bad">{error || writeErrorMsg}</div>
          )}

          {isConfirming && (
            <div className="notice notice-info">
              Transaction submitted. Waiting for confirmation…
            </div>
          )}

          <div
            className="paper-card-soft mono"
            style={{ fontSize: 12, lineHeight: 1.9, color: "var(--ink-3)" }}
          >
            <div>
              <span style={{ color: "var(--ink)" }}>Your address:</span>{" "}
              {address ?? circle.address ?? "—"}
            </div>
            <div>
              <span style={{ color: "var(--ink)" }}>Evaluator:</span> Gemini
              (server-side, automatic)
            </div>
            <div>
              <span style={{ color: "var(--ink)" }}>Escrow:</span> ERC-8183 on
              Arc Testnet
            </div>
            <div>
              <span style={{ color: "var(--ink)" }}>Gas token:</span> USDC (18
              decimals native)
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="btn btn-primary"
            style={{ height: 48, justifyContent: "center" }}
          >
            {isPending
              ? "Confirm in Wallet…"
              : isConfirming
              ? "Confirming…"
              : saving
              ? "Saving…"
              : "Create Job on Arc"}
          </button>
        </form>
      )}
    </div>
  );
}
