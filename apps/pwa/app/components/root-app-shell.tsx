"use client";

import type React from "react";
import dynamic from "next/dynamic";
import { ThemeController } from "./theme-controller";
import { AccessibilityController } from "./accessibility-controller";
import { ToastProvider } from "./toast-provider";
import { DesktopModeProvider } from "./desktop/desktop-mode-provider";
import { I18nProvider } from "./i18n-provider";
import { RootErrorBoundary } from "./root-error-boundary";
import { Preloader } from "./preloader";
import { StorageHealthBootstrap } from "./storage-health-bootstrap";
import { ProfileMigrationBootstrap } from "./profile-migration-bootstrap";
import { DesktopWindowRootSurface } from "./desktop/desktop-window-root-surface";
import { MobileModeProvider } from "./mobile/mobile-mode-provider";
import { NativeRuntimeGate } from "./native-runtime-gate";

const PwaServiceWorkerRegistrar = dynamic(
  () => import("./pwa-service-worker-registrar"),
  { ssr: false },
);

const DesktopUpdater = dynamic(
  () => import("./desktop-updater").then((mod) => ({ default: mod.DesktopUpdater })),
  { ssr: false },
);

const OfflineIndicator = dynamic(
  () => import("./desktop/offline-indicator").then((mod) => ({ default: mod.OfflineIndicator })),
  { ssr: false },
);

const DeepLinkHandler = dynamic(
  () => import("./desktop/deep-link-handler").then((mod) => ({ default: mod.DeepLinkHandler })),
  { ssr: false },
);

const ErrorPanel = dynamic(
  () => import("@/app/features/native/components/error-panel").then((mod) => ({ default: mod.ErrorPanel })),
  { ssr: false },
);

const MOBILE_SHELL_BUILD =
  process.env.NEXT_PUBLIC_MOBILE_SHELL === "1" ||
  process.env.NEXT_PUBLIC_MOBILE_SHELL === "true";

type RootAppShellProps = Readonly<{
  children: React.ReactNode;
}>;

/** Single client boundary for root layout — reduces layout.tsx client fan-out. */
export function RootAppShell({ children }: RootAppShellProps): React.JSX.Element {
  return (
    <NativeRuntimeGate>
      <Preloader />
      <RootErrorBoundary>
        <DesktopModeProvider>
          <MobileModeProvider>
            <ThemeController />
            <AccessibilityController />
            <StorageHealthBootstrap />
            <ProfileMigrationBootstrap />
            <I18nProvider>
              <PwaServiceWorkerRegistrar />
              <ToastProvider />
              <ErrorPanel />
              {!MOBILE_SHELL_BUILD ? <DesktopUpdater /> : null}
              <OfflineIndicator />
              <DeepLinkHandler />
              <div className="flex flex-col h-screen overflow-hidden desktop-mode:desktop-window-glow">
                <main className="flex-1 min-h-0 relative flex flex-col">
                  <DesktopWindowRootSurface>
                    {children}
                  </DesktopWindowRootSurface>
                </main>
              </div>
            </I18nProvider>
          </MobileModeProvider>
        </DesktopModeProvider>
      </RootErrorBoundary>
    </NativeRuntimeGate>
  );
}
