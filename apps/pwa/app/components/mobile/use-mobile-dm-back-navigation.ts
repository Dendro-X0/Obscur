"use client";

import { useEffect, useRef } from "react";
import { isMobileShellProduct } from "@/app/features/runtime/shell-contract";

/**
 * Maps hardware/browser back to leaving the active thread on mobile shell builds.
 */
export const useMobileDmBackNavigation = (
  showThread: boolean,
  onBack: () => void,
): void => {
  const onBackRef = useRef(onBack);
  const threadHistoryPushedRef = useRef(false);

  useEffect(() => {
    onBackRef.current = onBack;
  }, [onBack]);

  useEffect(() => {
    if (!isMobileShellProduct() || typeof window === "undefined") {
      return;
    }

    if (!showThread) {
      threadHistoryPushedRef.current = false;
      return;
    }

    const handlePopState = (): void => {
      onBackRef.current();
    };

    if (!threadHistoryPushedRef.current) {
      window.history.pushState({ obscurMobileDmThread: true }, "");
      threadHistoryPushedRef.current = true;
    }

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [showThread]);
};
