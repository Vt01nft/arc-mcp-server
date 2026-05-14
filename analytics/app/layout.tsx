import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Arc Analytics - Live Testnet Dashboard",
  description: "Real-time ERC-8183 job analytics and event feed for Arc Testnet, narrated by Claude.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-sm tracking-tight">Arc Analytics</span>
            <span className="text-xs text-zinc-500">Testnet</span>
          </div>
          <a
            href="https://testnet.arcscan.app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            ArcScan →
          </a>
        </header>
        <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
        <footer className="border-t border-zinc-800 px-6 py-4 text-center text-xs text-zinc-600">
          Arc Analytics - Phase 4 of the{" "}
          <a href="https://github.com/Vt01nft" className="hover:text-zinc-400 transition-colors">
            Arc Ecosystem
          </a>{" "}
          open source contribution
        </footer>
      </body>
    </html>
  );
}
