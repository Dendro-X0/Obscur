"use client";

import type React from "react";
import { useEffect } from "react";

type PwaServiceWorkerRegistrarResult = React.JSX.Element | null;

const PwaServiceWorkerRegistrar = (): PwaServiceWorkerRegistrarResult => {
  useEffect((): void => {
    if (typeof window === "undefined") {
      return;
    }
    if (!("serviceWorker" in navigator)) {
      return;
    }
    void navigator.serviceWorker.register("/sw.js").catch((): void => {
      return;
    });
  }, []);
  return null;
};

export default PwaServiceWorkerRegistrar;
