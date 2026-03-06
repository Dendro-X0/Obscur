import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import "./styles/mobile-safe-area.css"
import { ThemeController } from "./components/theme-controller"
import { AccessibilityController } from "./components/accessibility-controller"
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
import { AppProviders } from "./components/providers"
import { TitleBar } from "./components/desktop/title-bar"

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" })
const DESKTOP_SHELL_FLAG = process.env.NEXT_PUBLIC_DESKTOP_SHELL === "1" || process.env.NEXT_PUBLIC_DESKTOP_SHELL === "true"

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
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var forceDesktop = ${DESKTOP_SHELL_FLAG ? "true" : "false"};
                var markDesktopMode = function() {
                  var w = window;
                  var ua = navigator && navigator.userAgent ? navigator.userAgent : "";
                  var hasTauri = forceDesktop || !!w.__TAURI__ || !!w.__TAURI_INTERNALS__ || !!w.__TAURI_IPC__ || /\\bTauri\\b/i.test(ua);
                  if (!hasTauri) {
                    return false;
                  }
                  document.documentElement.classList.add("desktop-mode");
                  if (document.body) {
                    document.body.classList.add("desktop-mode");
                  }
                  return true;
                };
                if (markDesktopMode()) {
                  return;
                }
                var attempts = 0;
                var interval = setInterval(function() {
                  attempts += 1;
                  if (markDesktopMode() || attempts > 30) {
                    clearInterval(interval);
                  }
                }, 150);
              })();
            `,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var raw = localStorage.getItem('dweb.nostr.pwa.ui.accessibility.v1');
                  if (!raw) return;
                  var parsed = JSON.parse(raw);
                  var textScale = parsed && typeof parsed.textScale === 'number' ? parsed.textScale : 100;
                  var reducedMotion = !!(parsed && parsed.reducedMotion);
                  var contrastAssist = !!(parsed && parsed.contrastAssist);
                  var root = document.documentElement;
                  root.style.setProperty('--app-text-scale', String(textScale) + '%');
                  root.classList.toggle('reduce-motion', reducedMotion);
                  root.classList.toggle('contrast-assist', contrastAssist);
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className={`${geist.variable} ${geistMono.variable} font-sans antialiased bg-background text-foreground`} suppressHydrationWarning>
        <Preloader />
        <RootErrorBoundary>
          <DesktopModeProvider>
            <ThemeController />
            <AccessibilityController />
            <I18nProvider>
              <PwaServiceWorkerRegistrar />
              <ToastProvider />
              <ErrorPanel />
              <DesktopUpdater />
              <OfflineIndicator />
              <DeepLinkHandler />
              <AppProviders>
                <DesktopNotificationHandler />
                <div className={`flex flex-col h-screen overflow-hidden ${DESKTOP_SHELL_FLAG ? "desktop-mode desktop-window-glow" : "desktop-mode:desktop-window-glow"}`}>
                  <div className="relative z-[9999]">
                    <TitleBar />
                  </div>
                  <main className="flex-1 min-h-0 relative flex flex-col">
                    {children}
                  </main>
                </div>
              </AppProviders>
            </I18nProvider>
          </DesktopModeProvider>
        </RootErrorBoundary>
      </body>
    </html>
  )
}
