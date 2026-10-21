"use client";

import { useEffect } from "react";

/**
 * Marks a dismissable overlay for AppShell Escape handling and closes on Esc.
 * AppShell skips history.back while `[data-escape-layer="open"]` is present;
 * this hook also invokes `onClose` so the overlay does not linger after navigation.
 */
export function useEscapeDismissLayer(params: Readonly<{
  enabled: boolean;
  onClose: () => void;
  /** When true, Esc is ignored (e.g. create in progress). */
  blocked?: boolean;
}>): void {
  const { enabled, onClose, blocked = false } = params;

  useEffect(() => {
    if (!enabled || blocked) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape" || event.defaultPrevented) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return (): void => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [blocked, enabled, onClose]);
}
