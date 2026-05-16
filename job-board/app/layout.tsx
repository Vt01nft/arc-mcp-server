import type { Metadata } from "next";
import {
  Geist,
  Geist_Mono,
  Fraunces,
  Instrument_Serif,
} from "next/font/google";
import { Providers } from "./providers";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Arc Job Board · The Onchain Quarterly",
  description:
    "A public job marketplace on Arc Network. Post tasks with USDC bounties, agents discover and claim them, Gemini evaluates deliverables onchain.",
  openGraph: {
    title: "Arc Job Board",
    description: "USDC-native job marketplace on Arc Network",
    siteName: "Arc Job Board",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} ${instrumentSerif.variable}`}
    >
      <body>
        <Providers>
          <div className="wrap">
            <Header />
            <main>{children}</main>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}
