import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import type { JobCategory } from "@/lib/types";

type SaveJobBody = {
  chainJobId: number | null;
  description: string;
  category: JobCategory;
  clientAddress: string;
  providerAddress: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SaveJobBody;
    const { chainJobId, description, category, clientAddress, providerAddress } = body;

    if (!description || !providerAddress) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const db = getServiceClient();
    await db.from("jobs").insert({
      chain_job_id: chainJobId,
      description,
      category: category ?? "General",
      client_address: clientAddress,
      provider_address: providerAddress,
    });

    return NextResponse.json({ saved: true, chainJobId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Save job error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
