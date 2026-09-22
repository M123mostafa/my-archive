import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Lernarchiv — Fachinformatiker Systemintegration",
  description: "Persönliches digitales Wissensarchiv für die Umschulung zum Fachinformatiker Systemintegration.",
  keywords: ["Lernarchiv", "Fachinformatiker", "Systemintegration", "IT", "Umschulung"],
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.png", type: "image/png" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-icon.png",
  },
  openGraph: {
    title: "Lernarchiv — Fachinformatiker Systemintegration",
    description: "Persönliches digitales Wissensarchiv für die Umschulung zum Fachinformatiker Systemintegration.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#060607",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon.png" type="image/png" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-icon.png" />
      </head>
      <body className={`${inter.className} bg-[#060607] text-zinc-100 antialiased`}>{children}</body>
    </html>
  );
}
