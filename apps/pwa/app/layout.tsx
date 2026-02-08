import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import "./styles/mobile-safe-area.css"
import { ThemeController } from "./components/theme-controller"
import PwaServiceWorkerRegistrar from "./components/pwa-service-worker-registrar"
import { ToastProvider } from "./components/toast-provider"
import { DesktopUpdater } from "./components/desktop-updater"
import { DesktopModeProvider } from "./components/desktop/desktop-mode-provider"
import { OfflineIndicator } from "./components/desktop/offline-indicator"
import { DeepLinkHandler } from "./components/desktop/deep-link-handler"
import { I18nProvider } from "./components/i18n-provider"
import { RootErrorBoundary } from "./components/root-error-boundary"
import { Preloader } from "./components/preloader"
import { DesktopNotificationHandler } from "./components/desktop-notification-handler"
import { ErrorPanel } from "./features/native/components/error-panel"

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
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var preference = localStorage.getItem('dweb.nostr.pwa.ui.theme') || 'system';
                  var isDark = preference === 'dark' || (preference === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
                  document.documentElement.classList.toggle('dark', isDark);
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className={`${geist.variable} ${geistMono.variable} font-sans antialiased`} suppressHydrationWarning>
        <Preloader />
        <RootErrorBoundary>
          <DesktopModeProvider>
            <ThemeController />
            <I18nProvider>
              <PwaServiceWorkerRegistrar />
              <ToastProvider />
              <ErrorPanel />
              <DesktopUpdater />
              <OfflineIndicator />
              <DeepLinkHandler />
              <DesktopNotificationHandler />
              {children}
            </I18nProvider>
          </DesktopModeProvider>
        </RootErrorBoundary>
      </body>
    </html>
  )
}
