import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { SiteHeader } from "../components/SiteHeader";
import { DependencyStatusNotice } from "../components/DependencyStatusNotice";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const siteUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Cosmic Arcana — fictional tarot readings",
    template: "%s · Cosmic Arcana",
  },
  description:
    "Ask a question and receive a fictional tarot-style reading. Entertainment only — not advice and not a claim about the future. NASA data, when present, is symbolic context.",
  applicationName: "Cosmic Arcana",
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "Cosmic Arcana",
    title: "Cosmic Arcana — fictional tarot readings",
    description:
      "Fictional tarot-style readings for entertainment. Not a factual claim about the future.",
  },
  twitter: {
    card: "summary",
    title: "Cosmic Arcana — fictional tarot readings",
    description: "Fictional tarot-style readings. Entertainment, not a claim about the future.",
  },
  alternates: { canonical: "/" },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Cosmic Arcana",
  applicationCategory: "EntertainmentApplication",
  operatingSystem: "Web",
  description:
    "Fictional tarot-style readings for entertainment. Not advice and not a claim about the future.",
  url: siteUrl,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[#05010d] text-[#f5f3ff]">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <a
          href="#main"
          className="skip-link"
        >
          Skip to reading
        </a>
        <SiteHeader />
        <DependencyStatusNotice />
        {children}
      </body>
    </html>
  );
}
