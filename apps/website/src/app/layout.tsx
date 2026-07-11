import type { Metadata } from "next";
import { Fraunces, Space_Grotesk } from "next/font/google";
import { SiteFooter, SiteNav } from "./site-nav";
import "./globals.css";

const headlineFont = Fraunces({
  variable: "--font-headline",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const bodyFont = Space_Grotesk({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Obscur | Private Communication With Release Evidence",
  description:
    "Official Obscur website for release notes, architecture links, feature captures, and download artifacts.",
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
    <html lang="en">
      <body className={`${headlineFont.variable} ${bodyFont.variable}`}>
        <SiteNav />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
