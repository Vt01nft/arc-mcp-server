"use client";
// Thin client wrapper around the Circle W3S web SDK. The SDK renders Circle's
// own PIN / recovery UI overlay; we only feed it the session + challengeId.
import { W3SSdk } from "@circle-fin/w3s-pw-web-sdk";
import type { AbiFunction } from "viem";

let sdk: W3SSdk | null = null;

export function getSdk(appId: string): W3SSdk {
  if (!sdk) sdk = new W3SSdk();
  sdk.setAppSettings({ appId });
  return sdk;
}

// Drop the cached SDK so the next call builds a clean instance. A long-lived
// page can leave the singleton with a dead connection that surfaces as a
// Circle "Network error"; recreating it clears that.
export function resetSdk() {
  sdk = null;
}

export function setCircleAuth(
  appId: string,
  userToken: string,
  encryptionKey: string
) {
  const s = getSdk(appId);
  s.setAuthentication({ userToken, encryptionKey });
}

/** Run a Circle challenge (PIN setup or tx signing) and resolve on success. */
export function executeChallenge(
  appId: string,
  challengeId: string
): Promise<void> {
  const s = getSdk(appId);
  return new Promise((resolve, reject) => {
    s.execute(challengeId, (error) => {
      if (error) {
        // Surface Circle's real error code so an opaque "Network error"
        // is at least diagnosable.
        const code = (error as { code?: string | number }).code;
        // eslint-disable-next-line no-console
        console.error("Circle challenge error:", error);
        reject(
          new Error(
            `${error.message ?? "Circle challenge failed"}${
              code != null ? ` [code ${code}]` : ""
            }`
          )
        );
      } else {
        resolve();
      }
    });
  });
}

/** Build "name(type1,type2,...)" from an ABI + function name. */
export function abiFunctionSignature(
  abi: readonly unknown[],
  functionName: string
): string {
  const item = (abi as AbiFunction[]).find(
    (x) => x?.type === "function" && x?.name === functionName
  );
  if (!item) throw new Error(`function ${functionName} not in ABI`);
  return `${functionName}(${item.inputs.map((i) => i.type).join(",")})`;
}

/** JSON-safe args for Circle: bigint -> decimal string, leave the rest. */
export function serializeAbiParams(args: readonly unknown[]): unknown[] {
  return args.map((a) =>
    typeof a === "bigint" ? a.toString() : a
  );
}
