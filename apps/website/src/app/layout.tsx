import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import { FeedbackBand } from "./feedback-band";
import { SiteFooter, SiteNav } from "./site-nav";
import "./globals.css";

const headlineFont = Fraunces({
  variable: "--font-headline",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const bodyFont = Space_Grotesk({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const monoFont = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Obscur | Private Communication With Release Evidence",
  description:
    "Official Obscur site — private messaging with verified releases, a silent demo guide, active maintenance, and room for feedback or custom services.",
  icons: {
    icon: [
      {
        url: "/obscur-logo-light.svg",
        type: "image/svg+xml",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/obscur-logo-dark.svg",
        type: "image/svg+xml",
        media: "(prefers-color-scheme: dark)",
      },
    ],
    apple: "/obscur-logo-light.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <body className={`${headlineFont.variable} ${bodyFont.variable} ${monoFont.variable}`}>
        <SiteNav />
        {children}
        <FeedbackBand />
        <SiteFooter />
      </body>
    </html>
  );
}
