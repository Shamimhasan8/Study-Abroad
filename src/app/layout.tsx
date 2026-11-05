import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

/**
 * Fonts are SELF-HOSTED (next/font/local): next/font/google fetches font
 * files from Google's servers at BUILD time, so any deploy host with
 * blocked or flaky network access to fonts.googleapis.com fails the build
 * with 'NextFontGoogleFontFileReplacer ... module not found' — reproduced
 * as an intermittent deploy breaker. The woff2 files below are the exact
 * subsets previously served (latin for Geist/Geist Mono/Fraunces,
 * bengali for Noto Sans Bengali), vendored into the repository.
 */
const geistSans = localFont({
  src: "./fonts/Geist-Variable.woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
  display: "swap",
});

const geistMono = localFont({
  src: "./fonts/GeistMono-Variable.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
});

/** Editorial display face for English headings (soft-serif, warm, distinctive). */
const fraunces = localFont({
  src: "./fonts/Fraunces-Variable.woff2",
  variable: "--font-display",
  weight: "400 900",
  display: "swap",
});

/** Real Bengali typeface with proper line metrics for the Bangla interface. */
const notoBengali = localFont({
  src: "./fonts/NotoSansBengali-Variable.woff2",
  variable: "--font-noto-bengali",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Uraan — Study Abroad Preparation Workspace",
  description:
    "Plan your bachelor's, master's, or PhD route abroad with verified opportunities, transparent requirement gaps, and a realistic preparation plan. Built for Bangladeshi students.",
  applicationName: "Uraan",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F8F6F0",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} ${notoBengali.variable} antialiased bg-background text-foreground min-h-screen flex flex-col`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
