// Server-only Circle W3S (User-Controlled Wallets) helper.
// The CIRCLE_API_KEY never leaves the server. The short-lived userToken +
// encryptionKey are returned to the client because the Circle web SDK
// requires them; that is Circle's intended pattern.
import "server-only";

const BASE = "https://api.circle.com/v1/w3s";

function key(): string {
  const k = process.env.CIRCLE_API_KEY;
  if (!k) {
    const e = new Error("CIRCLE_API_KEY is not set") as Error & {
      status?: number;
    };
    e.status = 503;
    throw e;
  }
  return k;
}

async function circle<T>(
  path: string,
  init: RequestInit & { userToken?: string } = {}
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${key()}`,
    "Content-Type": "application/json",
  };
  if (init.userToken) headers["X-User-Token"] = init.userToken;
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  const body = (await res.json().catch(() => ({}))) as {
    data?: T;
    message?: string;
  };
  if (!res.ok) {
    const e = new Error(
      `Circle ${res.status}: ${body?.message ?? "request failed"}`
    ) as Error & { status?: number };
    e.status = res.status;
    throw e;
  }
  return body.data as T;
}

const uuid = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now()}-${Math.random().toString(16).slice(2)}`;

/** Create the Circle user (idempotent) and mint a session token. */
export async function getSession(userId: string): Promise<{
  userToken: string;
  encryptionKey: string;
}> {
  // 409 = user already exists; ignore it.
  await circle("/users", {
    method: "POST",
    body: JSON.stringify({ userId }),
  }).catch((e: { status?: number }) => {
    if (e?.status !== 409) throw e;
  });
  return circle<{ userToken: string; encryptionKey: string }>("/users/token", {
    method: "POST",
    body: JSON.stringify({ userId }),
  });
}

/** First-time: create the user's SCA wallet on Arc Testnet (PIN setup). */
export async function initializeWallet(userToken: string): Promise<string> {
  const d = await circle<{ challengeId: string }>("/user/initialize", {
    method: "POST",
    userToken,
    body: JSON.stringify({
      idempotencyKey: uuid(),
      accountType: "SCA",
      blockchains: ["ARC-TESTNET"],
    }),
  });
  return d.challengeId;
}

export async function listWallets(
  userToken: string
): Promise<{ id: string; address: string; blockchain: string }[]> {
  const d = await circle<{
    wallets: { id: string; address: string; blockchain: string }[];
  }>("/wallets", { method: "GET", userToken });
  return d.wallets ?? [];
}

/** Build a contract-execution challenge; client PIN-signs it via the SDK. */
export async function contractExecutionChallenge(
  userToken: string,
  args: {
    walletId: string;
    contractAddress: string;
    abiFunctionSignature: string;
    abiParameters: unknown[];
    amount?: string; // native value, decimal string (rare on Arc; USDC is ERC-20)
  }
): Promise<string> {
  const d = await circle<{ challengeId: string }>(
    "/user/transactions/contractExecution",
    {
      method: "POST",
      userToken,
      body: JSON.stringify({
        idempotencyKey: uuid(),
        walletId: args.walletId,
        contractAddress: args.contractAddress,
        abiFunctionSignature: args.abiFunctionSignature,
        abiParameters: args.abiParameters,
        amount: args.amount,
        feeLevel: "MEDIUM",
      }),
    }
  );
  return d.challengeId;
}
