import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { CosmicBackground } from "@/components/cosmic-background";
import { CompareTray } from "@/components/compare-tray";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Proven — BNB Agent Marketplace",
  description:
    "Every ERC-8004 agent on BNB Smart Chain, made legible: real published tools, live-verified endpoints, and one-click invocation — across rebalancing, grid, yield and health-factor agents.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <CosmicBackground />
        {children}
        <CompareTray />
      </body>
    </html>
  );
}
