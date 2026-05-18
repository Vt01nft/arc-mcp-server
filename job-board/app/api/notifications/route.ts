import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// GET /api/notifications?address=0x...  recent in-app notifications
export async function GET(req: NextRequest) {
  const address = (req.nextUrl.searchParams.get("address") ?? "")
    .trim()
    .toLowerCase();
  if (!address) return NextResponse.json({ notifications: [] });
  const { data, error } = await supabase
    .from("notifications")
    .select("chain_job_id, kind, message, created_at")
    .eq("client_address", address)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) return NextResponse.json({ notifications: [] });
  return NextResponse.json({ notifications: data ?? [] });
}
