import { NextRequest, NextResponse } from "next/server";
import { getSession, listWallets } from "@/lib/circle";

// POST { userId } -> { userToken, encryptionKey, appId, wallets }
// userId is any stable string the client chooses (e.g. an email).
export async function POST(req: NextRequest) {
  try {
    const { userId } = (await req.json()) as { userId?: string };
    const id = String(userId ?? "").trim().toLowerCase();
    if (!id || id.length < 3 || id.length > 120) {
      return NextResponse.json({ error: "valid userId required" }, { status: 400 });
    }
    const { userToken, encryptionKey } = await getSession(id);
    let wallets: { id: string; address: string; blockchain: string }[] = [];
    try {
      wallets = await listWallets(userToken);
    } catch {
      // no wallet yet — client will call /api/circle/initialize
    }
    return NextResponse.json({
      userToken,
      encryptionKey,
      appId: process.env.NEXT_PUBLIC_CIRCLE_APP_ID,
      wallets,
    });
  } catch (err) {
    const e = err as { status?: number; message?: string };
    console.error("Circle session error:", e?.message);
    return NextResponse.json(
      { error: "Circle session unavailable" },
      { status: e?.status && e.status >= 400 ? 502 : 500 }
    );
  }
}
