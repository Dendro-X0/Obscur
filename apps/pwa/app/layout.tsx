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
import { I18nProvider } from "./components/i18n-provider"
import { RootErrorBoundary } from "./components/root-error-boundary"

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
    <html lang="en" suppressHydrationWarning>
      <body className={`${geist.variable} ${geistMono.variable} font-sans antialiased`} suppressHydrationWarning>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.addEventListener('error', function(e) {
                // Check if the error is a chunk load error
                if (e.message && (e.message.includes('Loading chunk') || e.message.includes('ChunkLoadError'))) {
                  // Prevent infinite reload loops
                  if (!sessionStorage.getItem('chunk_retry_' + window.location.href)) {
                    sessionStorage.setItem('chunk_retry_' + window.location.href, 'true');
                    console.warn('Chunk load failed, reloading to fetch fresh chunks...');
                    window.location.reload();
                  }
                }
              });
            `,
          }}
        />
        <RootErrorBoundary>
          <DesktopModeProvider>
            <ThemeController />
            <I18nProvider>
              <PwaServiceWorkerRegistrar />
              <ToastProvider />
              <DesktopUpdater />
              <OfflineIndicator />
              <DeepLinkHandler />
              {children}
            </I18nProvider>
          </DesktopModeProvider>
        </RootErrorBoundary>
      </body>
    </html>
  )
}
