"use client";

import { http } from "wagmi";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { arcTestnet } from "./chain";

export { arcTestnet } from "./chain";

export const wagmiConfig = getDefaultConfig({
  appName: "Arc Job Board",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "arc-job-board",
  chains: [arcTestnet],
  transports: {
    [arcTestnet.id]: http(
      process.env.NEXT_PUBLIC_ARC_RPC ?? "https://rpc.testnet.arc.network"
    ),
  },
  ssr: true,
});
