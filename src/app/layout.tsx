import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { QueryProvider } from "@/lib/query-provider";
import { Analytics } from "@/components/Analytics";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Icons and social images come from the App Router's file conventions
// (icon.png, apple-icon.png, favicon.ico, opengraph-image.png,
// twitter-image.png alongside this file) — Next emits the <link>/<meta> tags
// for them, so they are deliberately not repeated here.
//
// metadataBase only affects how the social image URLs are made absolute;
// relative ones are ignored by most crawlers. NEXT_PUBLIC_SITE_URL lets a
// real deployment override the Vercel-generated host.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : "http://localhost:3081");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Earth Live",
  description: "The Earth, Live.",
  openGraph: {
    title: "Earth Live",
    description: "Real-time flights, earthquakes, wildfires and weather on a live 3D globe.",
    siteName: "Earth Live",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Earth Live",
    description: "Real-time flights, earthquakes, wildfires and weather on a live 3D globe.",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full w-full overflow-hidden">
        <QueryProvider>{children}</QueryProvider>
        <Analytics />
      </body>
    </html>
  );
}
