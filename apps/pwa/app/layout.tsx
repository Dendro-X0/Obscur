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
import { StorageHealthBootstrap } from "./components/storage-health-bootstrap"
import { ErrorPanel } from "./features/native/components/error-panel"
import { AppProviders } from "./components/providers"
import { TitleBar } from "./components/desktop/title-bar"
import { NativeRuntimeGate } from "./components/native-runtime-gate"
import { ProfileMigrationBootstrap } from "./components/profile-migration-bootstrap"

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
                  var registryRaw = localStorage.getItem('obscur.profiles.registry.v1');
                  var activeProfileId = 'default';
                  if (registryRaw) {
                    try {
                      var registry = JSON.parse(registryRaw);
                      if (registry && typeof registry.activeProfileId === 'string' && registry.activeProfileId.trim().length > 0) {
                        activeProfileId = registry.activeProfileId.trim();
                      }
                    } catch (e) {}
                  }
                  var scopedThemeKey = 'dweb.nostr.pwa.ui.theme::' + activeProfileId;
                  var preference = localStorage.getItem(scopedThemeKey) || localStorage.getItem('dweb.nostr.pwa.ui.theme') || 'system';
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
                var markDesktopMode = function() {
                  var w = window;
                  var hasCallableBridge =
                    typeof (w.__TAURI_INTERNALS__ && w.__TAURI_INTERNALS__.invoke) === "function" ||
                    typeof (w.__TAURI__ && w.__TAURI__.core && w.__TAURI__.core.invoke) === "function" ||
                    typeof w.__TAURI_IPC__ === "function";
                  if (!hasCallableBridge) {
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
                  var registryRaw = localStorage.getItem('obscur.profiles.registry.v1');
                  var activeProfileId = 'default';
                  if (registryRaw) {
                    try {
                      var registry = JSON.parse(registryRaw);
                      if (registry && typeof registry.activeProfileId === 'string' && registry.activeProfileId.trim().length > 0) {
                        activeProfileId = registry.activeProfileId.trim();
                      }
                    } catch (e) {}
                  }
                  var scopedAccessibilityKey = 'dweb.nostr.pwa.ui.accessibility.v1::' + activeProfileId;
                  var raw = localStorage.getItem(scopedAccessibilityKey) || localStorage.getItem('dweb.nostr.pwa.ui.accessibility.v1');
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
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var PRELOADER_FAILSAFE_TIMEOUT_MS = 3500;
                var released = false;
                var releaseBody = function(reason) {
                  if (released || !document.body) {
                    return;
                  }
                  released = true;
                  var body = document.body;
                  var hadHiddenBody = body.style.visibility === "hidden";
                  var hadPreloadingClass = body.classList.contains("preloading");
                  body.classList.remove("preloading");
                  body.style.removeProperty("visibility");
                  if (reason === "failsafe_timeout" && (hadHiddenBody || hadPreloadingClass)) {
                    try {
                      console.warn("[boot] preloader fail-safe forced startup visibility release");
                    } catch (e) {}
                  }
                };
                if (document.readyState === "loading") {
                  document.addEventListener("DOMContentLoaded", function() {
                    releaseBody("dom_content_loaded");
                  }, { once: true });
                } else {
                  releaseBody("ready_state");
                }
                window.addEventListener("load", function() {
                  releaseBody("window_load");
                }, { once: true });
                window.setTimeout(function() {
                  releaseBody("failsafe_timeout");
                }, PRELOADER_FAILSAFE_TIMEOUT_MS);
              })();
            `,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var BOOT_STALL_TIMEOUT_MS = 12000;
                var OVERLAY_ID = "obscur-boot-stall-overlay";
                var AUTO_RECOVERY_ATTEMPT_STORAGE_KEY = "obscur.boot.watchdog.auto_recovery_attempts.v1";
                var AUTO_RECOVERY_LAST_EVENT_STORAGE_KEY = "obscur.boot.watchdog.auto_recovery_last_event.v1";
                var AUTO_RECOVERY_MAX_ATTEMPTS_PER_TAB = 1;

                var removeOverlay = function() {
                  var existing = document.getElementById(OVERLAY_ID);
                  if (!existing || !existing.parentNode) {
                    return;
                  }
                  existing.parentNode.removeChild(existing);
                };

                var markBootReady = function() {
                  try {
                    window.__obscurBootReady = true;
                  } catch (e) {}
                  removeOverlay();
                };

                var hardReload = function() {
                  window.location.reload();
                };

                var recoverAndReload = function() {
                  var completeReload = function() {
                    try {
                      window.location.reload();
                    } catch (e) {
                      hardReload();
                    }
                  };
                  if (!("serviceWorker" in navigator)) {
                    completeReload();
                    return;
                  }
                  navigator.serviceWorker.getRegistrations()
                    .then(function(registrations) {
                      return Promise.all(registrations.map(function(registration) {
                        return registration.unregister().catch(function() { return false; });
                      }));
                    })
                    .then(function() {
                      if (!("caches" in window)) {
                        return;
                      }
                      return caches.keys().then(function(keys) {
                        return Promise.all(keys.map(function(key) {
                          return caches.delete(key).catch(function() { return false; });
                        }));
                      });
                    })
                    .finally(completeReload);
                };

                var readAutoRecoveryAttempts = function() {
                  try {
                    var raw = window.sessionStorage.getItem(AUTO_RECOVERY_ATTEMPT_STORAGE_KEY);
                    if (!raw) {
                      return 0;
                    }
                    var parsed = Number(raw);
                    if (!Number.isFinite(parsed) || parsed <= 0) {
                      return 0;
                    }
                    return Math.floor(parsed);
                  } catch (e) {
                    // If sessionStorage is unavailable, never attempt automatic reload loops.
                    return AUTO_RECOVERY_MAX_ATTEMPTS_PER_TAB;
                  }
                };

                var reserveAutoRecoveryAttempt = function() {
                  try {
                    var nextAttempt = readAutoRecoveryAttempts() + 1;
                    window.sessionStorage.setItem(AUTO_RECOVERY_ATTEMPT_STORAGE_KEY, String(nextAttempt));
                    return nextAttempt;
                  } catch (e) {
                    return null;
                  }
                };

                var persistAutoRecoveryEvent = function(payload) {
                  try {
                    window.sessionStorage.setItem(AUTO_RECOVERY_LAST_EVENT_STORAGE_KEY, JSON.stringify(payload));
                  } catch (e) {}
                };

                var attemptAutoRecoveryOnBootStall = function() {
                  if (window.__obscurBootReady === true) {
                    return false;
                  }
                  if (readAutoRecoveryAttempts() >= AUTO_RECOVERY_MAX_ATTEMPTS_PER_TAB) {
                    return false;
                  }
                  var attempt = reserveAutoRecoveryAttempt();
                  if (attempt === null) {
                    return false;
                  }
                  var eventPayload = {
                    type: "auto_recovery_started",
                    reason: "boot_stall_timeout",
                    attempt: attempt,
                    atUnixMs: Date.now(),
                  };
                  persistAutoRecoveryEvent(eventPayload);
                  try {
                    console.warn("[boot-watchdog] automatic recovery started", eventPayload);
                  } catch (e) {}
                  recoverAndReload();
                  return true;
                };

                var showOverlay = function() {
                  if (window.__obscurBootReady === true) {
                    return;
                  }
                  if (attemptAutoRecoveryOnBootStall()) {
                    return;
                  }
                  if (document.getElementById(OVERLAY_ID)) {
                    return;
                  }
                  var body = document.body;
                  if (!body) {
                    window.setTimeout(showOverlay, 200);
                    return;
                  }

                  var overlay = document.createElement("div");
                  overlay.id = OVERLAY_ID;
                  overlay.style.position = "fixed";
                  overlay.style.inset = "0";
                  overlay.style.zIndex = "2147483647";
                  overlay.style.display = "flex";
                  overlay.style.alignItems = "center";
                  overlay.style.justifyContent = "center";
                  overlay.style.background = "rgba(9, 10, 14, 0.94)";
                  overlay.style.color = "#f5f7ff";
                  overlay.style.fontFamily = "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif";
                  overlay.style.padding = "24px";

                  var card = document.createElement("div");
                  card.style.maxWidth = "560px";
                  card.style.width = "100%";
                  card.style.borderRadius = "16px";
                  card.style.padding = "20px";
                  card.style.background = "rgba(17, 20, 30, 0.96)";
                  card.style.border = "1px solid rgba(148, 163, 184, 0.28)";
                  card.style.boxShadow = "0 12px 36px rgba(2, 6, 23, 0.55)";

                  var title = document.createElement("h2");
                  title.textContent = "Startup Is Taking Longer Than Expected";
                  title.style.margin = "0 0 10px";
                  title.style.fontSize = "20px";
                  title.style.fontWeight = "700";

                  var detail = document.createElement("p");
                  detail.textContent = "Obscur did not finish web bootstrap in time. You can reload, or run recovery that clears service worker/cache first.";
                  detail.style.margin = "0 0 16px";
                  detail.style.fontSize = "14px";
                  detail.style.lineHeight = "1.5";
                  detail.style.opacity = "0.9";

                  var actions = document.createElement("div");
                  actions.style.display = "flex";
                  actions.style.gap = "10px";
                  actions.style.flexWrap = "wrap";

                  var reloadButton = document.createElement("button");
                  reloadButton.type = "button";
                  reloadButton.textContent = "Reload";
                  reloadButton.style.padding = "10px 14px";
                  reloadButton.style.borderRadius = "10px";
                  reloadButton.style.border = "1px solid rgba(148, 163, 184, 0.45)";
                  reloadButton.style.background = "rgba(30, 41, 59, 0.9)";
                  reloadButton.style.color = "#f8fafc";
                  reloadButton.style.cursor = "pointer";
                  reloadButton.onclick = hardReload;

                  var recoverButton = document.createElement("button");
                  recoverButton.type = "button";
                  recoverButton.textContent = "Recover + Reload";
                  recoverButton.style.padding = "10px 14px";
                  recoverButton.style.borderRadius = "10px";
                  recoverButton.style.border = "1px solid rgba(59, 130, 246, 0.6)";
                  recoverButton.style.background = "rgba(37, 99, 235, 0.92)";
                  recoverButton.style.color = "#eff6ff";
                  recoverButton.style.cursor = "pointer";
                  recoverButton.onclick = recoverAndReload;

                  actions.appendChild(reloadButton);
                  actions.appendChild(recoverButton);
                  card.appendChild(title);
                  card.appendChild(detail);
                  card.appendChild(actions);
                  overlay.appendChild(card);
                  body.appendChild(overlay);

                  try {
                    console.warn("[boot-watchdog] startup stall fallback shown");
                  } catch (e) {}
                };

                window.addEventListener("obscur:boot-ready", markBootReady, { once: true });
                window.addEventListener("load", function() {
                  if (window.__obscurBootReady === true) {
                    removeOverlay();
                  }
                }, { once: true });

                window.setTimeout(showOverlay, BOOT_STALL_TIMEOUT_MS);
              })();
            `,
          }}
        />
      </head>
      <body className={`${geist.variable} ${geistMono.variable} font-sans antialiased bg-background text-foreground`} suppressHydrationWarning>
        <NativeRuntimeGate>
          <Preloader />
          <RootErrorBoundary>
            <DesktopModeProvider>
              <ThemeController />
              <AccessibilityController />
              <StorageHealthBootstrap />
              <ProfileMigrationBootstrap />
              <I18nProvider>
                <PwaServiceWorkerRegistrar />
                <ToastProvider />
                <ErrorPanel />
                <DesktopUpdater />
                <OfflineIndicator />
                <DeepLinkHandler />
                  <div className="flex flex-col h-screen overflow-hidden desktop-mode:desktop-window-glow">
                    <div className="relative z-[9999]">
                      <TitleBar />
                    </div>
                    <main className="flex-1 min-h-0 relative flex flex-col">
                      <AppProviders>
                        <DesktopNotificationHandler />
                        {children}
                      </AppProviders>
                    </main>
                  </div>
              </I18nProvider>
            </DesktopModeProvider>
          </RootErrorBoundary>
        </NativeRuntimeGate>
      </body>
    </html>
  )
}
