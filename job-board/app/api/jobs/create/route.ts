import { NextRequest, NextResponse } from "next/server";
import { zeroAddress, decodeEventLog } from "viem";
import { publicClient, getWalletClient } from "@/lib/viem";
import { getServiceClient } from "@/lib/supabase";
import { ADDRESSES } from "@/contracts/addresses";
import { ERC8183_ABI } from "@/contracts/abis";
import type { JobCategory } from "@/lib/types";

type CreateJobBody = {
  description: string;
  category: JobCategory;
  providerAddress: string;
  expiryHours: number;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CreateJobBody;
    const { description, category, providerAddress, expiryHours } = body;

    if (!description || !providerAddress || !expiryHours) {
      return NextResponse.json(
        { error: "description, providerAddress, and expiryHours are required" },
        { status: 400 }
      );
    }

    const walletClient = getWalletClient();
    const evaluatorAddress = walletClient.account.address;

    const expiryTimestamp =
      BigInt(Math.floor(Date.now() / 1000)) + BigInt(expiryHours * 3600);

    const { request } = await publicClient.simulateContract({
      address: ADDRESSES.ERC8183_JOB,
      abi: ERC8183_ABI,
      functionName: "createJob",
      args: [
        providerAddress as `0x${string}`,
        evaluatorAddress,
        expiryTimestamp,
        description, // on-chain description is a string, not a hash
        zeroAddress, // no hook (address(0) is whitelisted)
      ],
      account: walletClient.account,
    });

    const txHash = await walletClient.writeContract(request);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    // Extract jobId from JobCreated event
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
        // not a JobCreated log, skip
      }
    }

    // Persist metadata to Supabase
    if (chainJobId !== null) {
      try {
        const db = getServiceClient();
        await db.from("jobs").insert({
          chain_job_id: chainJobId,
          description,
          category: category ?? "General",
          client_address: evaluatorAddress,
          provider_address: providerAddress,
        });
      } catch (dbErr) {
        console.error("Failed to persist job metadata:", dbErr);
      }
    }

    return NextResponse.json({
      txHash,
      chainJobId,
      status: "created",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Create job error:", message);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
