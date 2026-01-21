import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { ThemeController } from "./components/theme-controller"
import PwaServiceWorkerRegistrar from "./components/pwa-service-worker-registrar"
import { ToastProvider } from "./components/toast-provider"
import { DesktopUpdater } from "./components/desktop-updater"
import { DesktopModeProvider } from "./components/desktop/desktop-mode-provider"
import { OfflineIndicator } from "./components/desktop/offline-indicator"
import { DeepLinkHandler } from "./components/desktop/deep-link-handler"

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" })

export const metadata: Metadata = {
  title: "Obscur",
  description: "Secure, encrypted messaging on the Nostr protocol with NIP-04 encryption",
  generator: "v0.app",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/obscur-logo-light.svg", type: "image/svg+xml", media: "(prefers-color-scheme: light)" },
      { url: "/obscur-logo-dark.svg", type: "image/svg+xml", media: "(prefers-color-scheme: dark)" },
    ],
    apple: "/apple-touch-icon.png",
  },
}

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${geist.variable} ${geistMono.variable} font-sans antialiased`}>
        <DesktopModeProvider>
          <ThemeController />
          <PwaServiceWorkerRegistrar />
          <ToastProvider />
          <DesktopUpdater />
          <OfflineIndicator />
          <DeepLinkHandler />
          {children}
        </DesktopModeProvider>
      </body>
    </html>
  )
}
