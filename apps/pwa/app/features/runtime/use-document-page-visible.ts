"use client";

import { useEffect, useState } from "react";

/** True when this window/tab is visible (not minimized or backgrounded). */
export const isDocumentPageVisible = (): boolean => (
  typeof document === "undefined" || !document.hidden
);

export const useDocumentPageVisible = (): boolean => {
  const [visible, setVisible] = useState(isDocumentPageVisible);

  useEffect(() => {
    const sync = (): void => {
      setVisible(isDocumentPageVisible());
    };
    document.addEventListener("visibilitychange", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  return visible;
};
