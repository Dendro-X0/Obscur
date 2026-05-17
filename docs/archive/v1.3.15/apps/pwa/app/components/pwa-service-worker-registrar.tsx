"use client";

import type React from "react";
import { useEffect } from "react";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";

type PwaServiceWorkerRegistrarResult = React.JSX.Element | null;

const unregisterAllServiceWorkers = (): void => {
  void navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      void registration.unregister();
    });
  }).catch((): void => {
    return;
  });
};

const PwaServiceWorkerRegistrar = (): PwaServiceWorkerRegistrarResult => {
  useEffect((): void => {
    if (typeof window === "undefined") {
      return;
    }
    const isDesktopShellBuild = process.env.NEXT_PUBLIC_DESKTOP_SHELL === "1";
    if (isDesktopShellBuild) {
      if ("serviceWorker" in navigator) {
        unregisterAllServiceWorkers();
      }
      return;
    }
    if (hasNativeRuntime()) {
      return;
    }
    if (!("serviceWorker" in navigator)) {
      return;
    }
    if (process.env.NODE_ENV !== "production") {
      unregisterAllServiceWorkers();
      return;
    }
    void navigator.serviceWorker.register("/sw.js").catch((): void => {
      return;
    });
  }, []);
  return null;
};

export default PwaServiceWorkerRegistrar;
