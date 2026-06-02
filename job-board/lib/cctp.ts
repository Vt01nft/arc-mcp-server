// CCTP v2: cross-chain USDC into Arc. The flow is:
//   1. Source chain (e.g. Optimism Sepolia, domain 2): the user approves USDC
//      to the TokenMessenger and calls depositForBurn(..., destinationDomain=26
//      (Arc), mintRecipient=their Arc address). This burns USDC there.
//   2. Circle's attestation service (Iris) observes the burn and, once final,
//      serves the message + attestation.
//   3. Arc (domain 26): anyone calls MessageTransmitter.receiveMessage(message,
//      attestation), which mints the USDC to the recipient on Arc.
//
// The burn (step 1) needs a signer on the SOURCE chain — out of scope for the
// Arc-only Circle wallet, so it's done by the user's own Optimism wallet (or
// scripts/cctp-burn.mjs for testing). Steps 2-3 are server-side and live here:
// given a source burn tx, the server fetches the attestation and completes the
// mint on Arc, so the user never needs Arc gas to receive.
import { pad, type Hex } from "viem";
import { publicClient, getWalletClient } from "./viem";
import {
  ADDRESSES,
  CCTP_DOMAIN,
  CCTP_IRIS_SANDBOX,
} from "@/contracts/addresses";
import { CCTP_MESSAGE_TRANSMITTER_ABI } from "@/contracts/abis";

export { CCTP_DOMAIN };

// Encode an EVM address as a CCTP bytes32 mintRecipient (left-padded).
export function addressToBytes32(addr: `0x${string}`): Hex {
  return pad(addr, { size: 32 });
}

export type Attestation = {
  status: "pending_confirmations" | "complete" | string;
  message?: Hex;
  attestation?: Hex;
  eventNonce?: string;
};

// Poll Circle's Iris sandbox for the attestation of a source burn tx.
// Returns the message + attestation once status === "complete".
export async function fetchAttestation(
  sourceDomain: number,
  burnTxHash: `0x${string}`,
  opts: { attempts?: number; intervalMs?: number } = {}
): Promise<Attestation> {
  const attempts = opts.attempts ?? 30;
  const intervalMs = opts.intervalMs ?? 6000;
  const url = `${CCTP_IRIS_SANDBOX}/v2/messages/${sourceDomain}?transactionHash=${burnTxHash}`;

  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (res.ok) {
        const data = (await res.json()) as { messages?: Attestation[] };
        const m = data.messages?.[0];
        if (m && m.status === "complete" && m.message && m.attestation) {
          return m;
        }
      }
      // 404 simply means Iris hasn't indexed the burn yet; keep polling.
    } catch {
      /* transient; retry */
    }
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, intervalMs));
  }
  return { status: "pending_confirmations" };
}

// Complete the transfer on Arc: server submits receiveMessage, paying Arc gas.
// Permissionless (unless the burn pinned a destinationCaller). Mints USDC to
// the recipient that was set as mintRecipient in the source burn.
export async function mintOnArc(
  message: Hex,
  attestation: Hex
): Promise<`0x${string}`> {
  const wallet = getWalletClient();
  const tx = await wallet.writeContract({
    address: ADDRESSES.CCTP_MESSAGE_TRANSMITTER,
    abi: CCTP_MESSAGE_TRANSMITTER_ABI,
    functionName: "receiveMessage",
    args: [message, attestation],
  });
  await publicClient.waitForTransactionReceipt({ hash: tx });
  return tx;
}

// One-shot: given a source burn tx, wait for attestation then mint on Arc.
export async function completeInboundTransfer(opts: {
  sourceDomain?: number;
  burnTxHash: `0x${string}`;
}): Promise<{ ok: boolean; mintTx?: `0x${string}`; status: string }> {
  const sourceDomain = opts.sourceDomain ?? CCTP_DOMAIN.OPTIMISM_SEPOLIA;
  const att = await fetchAttestation(sourceDomain, opts.burnTxHash);
  if (att.status !== "complete" || !att.message || !att.attestation) {
    return { ok: false, status: att.status };
  }
  const mintTx = await mintOnArc(att.message, att.attestation);
  return { ok: true, mintTx, status: "minted" };
}
