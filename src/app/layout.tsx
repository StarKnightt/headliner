import type { Metadata, Viewport } from "next";
import { Big_Shoulders, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const display = Big_Shoulders({ subsets: ["latin"], weight: ["600", "800", "900"], variable: "--nf-display", adjustFontFallback: false });
const sans = Instrument_Sans({ subsets: ["latin"], variable: "--nf-body" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--nf-data" });

const description =
  "A booking agent for independent artists. Qloo taste data finds the cities where your fans already rank highest, the rooms they go to, the acts they share and the brands they love.";

export const metadata: Metadata = {
  metadataBase: new URL("https://headliner-five.vercel.app"),
  title: "Headliner · Tour where your fans already are",
  description,
  openGraph: { title: "Headliner · Tour where your fans already are", description, type: "website", siteName: "Headliner" },
  twitter: { card: "summary_large_image", title: "Headliner · Tour where your fans already are", description },
};

export const viewport: Viewport = { themeColor: "#07080c", colorScheme: "dark" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
