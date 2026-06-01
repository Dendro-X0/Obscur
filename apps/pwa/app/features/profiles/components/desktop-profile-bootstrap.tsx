"use client";

import type React from "react";
import { useEffect, useState } from "react";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { startDesktopWindowBoot } from "@/app/features/profiles/services/desktop-window-boot";
import { AppLoadingScreen } from "@/app/components/app-loading-screen";
import { isExperimentShellEnabled } from "@/app/features/runtime/experiment-shell-policy";
import { isDesktopShellBuild, isMobileShellBuild } from "@/app/features/runtime/shell-contract";

/** Dev web shell only — production desktop/mobile never block on profile IPC. */
const shouldBlockBootScreen = (): boolean => {
  if (hasNativeRuntime()) {
    return false;
  }
  return !isExperimentShellEnabled() && !isDesktopShellBuild() && !isMobileShellBuild();
};

export function DesktopProfileBootstrap(props: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  const [bootReady, setBootReady] = useState(!shouldBlockBootScreen());

  useEffect(() => {
    if (!shouldBlockBootScreen()) {
      startDesktopWindowBoot();
      setBootReady(true);
      return;
    }

    const readyTimer = window.setTimeout(() => {
      setBootReady(true);
    }, 0);

    return () => {
      window.clearTimeout(readyTimer);
    };
  }, []);

  if (!bootReady) {
    return (
      <AppLoadingScreen
        title="Starting Obscur"
        detail="Preparing profile workspace and startup services..."
      />
    );
  }

  return <>{props.children}</>;
}
