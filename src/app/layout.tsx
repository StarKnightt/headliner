import type { Metadata, Viewport } from "next";
import { Big_Shoulders, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const display = Big_Shoulders({ subsets: ["latin"], weight: ["600", "800", "900"], variable: "--nf-display", adjustFontFallback: false });
const sans = Instrument_Sans({ subsets: ["latin"], variable: "--nf-body" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--nf-data" });

export const metadata: Metadata = {
  title: "Headliner · Tour where your fans already are",
  description:
    "A tour-routing agent for independent artists. Qloo taste data finds the cities, rooms, co-headliners and brand partners that match your audience, on a 3D night globe.",
};

export const viewport: Viewport = { themeColor: "#07080c", colorScheme: "dark" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
