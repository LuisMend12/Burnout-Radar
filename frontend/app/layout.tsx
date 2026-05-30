import type { Metadata } from "next";
import { Inter, Orbitron, Space_Grotesk } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const orbitron = Orbitron({
  subsets: ["latin"],
  variable: "--font-orbitron",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Burnout Radar — Real-Time Wellness Intelligence",
  description:
    "AI-powered mental wellness dashboard combining voice biomarker analysis and EEG biofeedback to estimate stress, focus, and burnout risk in real time.",
  keywords: ["burnout", "wellness", "mental health", "EEG", "biofeedback", "stress monitoring"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${orbitron.variable} ${spaceGrotesk.variable} bg-background text-slate-100 antialiased`}
      >
        <div className="ambient-orb-left" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
