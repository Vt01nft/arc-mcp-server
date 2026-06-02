# CCTP v2 — cross-chain USDC into Arc

Bring USDC to Arc from another CCTP chain (Optimism Sepolia on testnet) via
Circle's burn-and-mint. Arc mints the same amount the source chain burns.

## Verified facts (testnet)

| | Arc Testnet | Optimism Sepolia |
|---|---|---|
| CCTP domain | **26** | **2** |
| TokenMessengerV2 | `0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA` | same |
| MessageTransmitterV2 | `0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275` | same |
| USDC | `0x3600000000000000000000000000000000000000` | `0x5fd84259d66Cd46123540766Be93DFE6D43130D7` |

Verified on-chain: both contracts have code on Arc; `MessageTransmitter.localDomain == 26`.
`depositForBurn` / `receiveMessage` signatures verified from the arcscan impl
ABIs (TokenMessenger impl `0xf07c0ad1…`, Transmitter impl `0xa849059b…`).

Attestation service (sandbox): `https://iris-api-sandbox.circle.com/v2/messages/{srcDomain}?transactionHash={tx}`.

## Flow

1. **Burn (source chain, user's wallet).** Approve USDC to the TokenMessenger,
   then `depositForBurn(amount, 26, mintRecipient=ArcAddress as bytes32,
   burnToken=USDC, destinationCaller=0, maxFee=0, minFinalityThreshold=2000)`.
2. **Attestation (Circle).** Iris observes the burn and, once final, serves the
   `message` + `attestation`.
3. **Mint (Arc, server).** `MessageTransmitter.receiveMessage(message,
   attestation)` mints to the recipient. Permissionless, so our server submits
   it and pays the Arc gas — the user needs no Arc USDC to receive.

## In this repo

- `lib/cctp.ts` — `fetchAttestation`, `mintOnArc`, `completeInboundTransfer`.
- `POST /api/cctp/receive { burnTxHash, sourceDomain? }` — polls the
  attestation and completes the mint on Arc. Returns `{ ok, mintTx }`, or 202
  `{ retry: true }` while the attestation is still pending.
- `/cctp` page — paste a burn tx hash, the server completes the Arc mint.
- `scripts/cctp-burn.mjs` — scripted test burn on Optimism Sepolia.

## Testing (needs Optimism Sepolia funds)

The burn side requires an Optimism Sepolia wallet with testnet USDC + ETH
(out of scope for the Arc-only Circle wallet). To run a full cross-chain test:

```
OP_PK=0x... ARC_RECIPIENT=0xYourArcAddr AMOUNT=1 node scripts/cctp-burn.mjs
# then paste the printed BURN TX into /cctp, or:
curl -XPOST localhost:3000/api/cctp/receive \
  -H 'content-type: application/json' \
  -d '{"burnTxHash":"0x<burn tx>"}'
```

The Arc-side mint (steps 2-3) is fully implemented and uses verified
addresses/ABIs; it has not been run end-to-end here because it requires
funded Optimism Sepolia USDC to produce a real burn.

## Mainnet

Same code, mainnet domains/addresses (Arc Mainnet domain + Circle mainnet Iris
`https://iris-api.circle.com`). Swap `CCTP_DOMAIN`, `CCTP_IRIS_SANDBOX`, and
the USDC addresses when Arc Mainnet is GA.
