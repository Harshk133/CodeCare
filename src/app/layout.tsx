import type { Metadata, Viewport } from "next";
import {
  Baloo_2,
  Baloo_Bhai_2,
  Baloo_Da_2,
  Baloo_Tammudu_2,
  Baloo_Thambi_2,
  Mukta,
} from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/shared/ThemeProvider";

const baloo = Baloo_2({
  subsets: ["latin", "devanagari"],
  variable: "--font-baloo",
});

const mukta = Mukta({
  subsets: ["latin", "devanagari"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mukta",
});

// Per-script siblings: only downloaded when a glyph from that script appears.
const balooTamil = Baloo_Thambi_2({ subsets: ["tamil"], variable: "--font-baloo-ta", preload: false });
const balooTelugu = Baloo_Tammudu_2({ subsets: ["telugu"], variable: "--font-baloo-te", preload: false });
const balooBengali = Baloo_Da_2({ subsets: ["bengali"], variable: "--font-baloo-bn", preload: false });
const balooGujarati = Baloo_Bhai_2({ subsets: ["gujarati"], variable: "--font-baloo-gu", preload: false });

export const metadata: Metadata = {
  title: "SwasthyaAI - Multilingual AI Public Health Assistant",
  description:
    "AI-powered multilingual health assistant for symptom triage, hospital finder, emergency detection, disease awareness, and outbreak notifications.",
  // Mobile web app manifest hints
  other: {
    "mobile-web-app-capable":       "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // extends into notch / dynamic island area on iOS
  themeColor: "#2B3A99",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={[
        baloo.variable,
        mukta.variable,
        balooTamil.variable,
        balooTelugu.variable,
        balooBengali.variable,
        balooGujarati.variable,
      ].join(" ")}
      suppressHydrationWarning
    >
      <body
        className="bg-background font-sans text-foreground antialiased"
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
          paddingLeft: "env(safe-area-inset-left)",
          paddingRight: "env(safe-area-inset-right)",
        }}
      >
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
