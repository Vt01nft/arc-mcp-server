import { NextRequest, NextResponse } from "next/server";
import { initializeWallet } from "@/lib/circle";

// POST { userToken } -> { challengeId }  (first-time wallet + PIN setup)
export async function POST(req: NextRequest) {
  try {
    const { userToken } = (await req.json()) as { userToken?: string };
    if (!userToken || userToken.length < 10) {
      return NextResponse.json({ error: "userToken required" }, { status: 400 });
    }
    const challengeId = await initializeWallet(userToken);
    return NextResponse.json({ challengeId });
  } catch (err) {
    const e = err as { status?: number; message?: string };
    console.error("Circle initialize error:", e?.message);
    return NextResponse.json(
      { error: "Circle wallet init failed" },
      { status: e?.status && e.status >= 400 ? 502 : 500 }
    );
  }
}
