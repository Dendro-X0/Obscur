"use client";
/**
 * use-relay-primary-selection.ts
 *
 * React hook that owns primary/standby selection state.
 *
 * - On first render (or when the relay list changes) it picks the initial
 *   primary via resolveInitialRelaySelection.
 * - Exposes `triggerFailover()` which is called by RelayProvider when the
 *   watchdog declares the primary dead.  Failover is silent and automatic.
 * - The hook emits a toast-level notification (console.info) on failover so
 *   the status bar can surface it without a modal prompt.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  resolveInitialRelaySelection,
  resolveFailoverRelaySelection,
  type RelayPrimarySelection,
  type RelayHealthHint,
} from "../services/relay-primary-selector";

export type { RelayPrimarySelection, RelayRole, RelaySelectionEntry } from "../services/relay-primary-selector";

export type UseRelayPrimarySelectionResult = Readonly<{
  selection: RelayPrimarySelection;
  triggerFailover: (hints?: ReadonlyArray<RelayHealthHint>) => void;
  setPrimaryManual: (url: string) => void;
}>;

export const useRelayPrimarySelection = (
  orderedEnabledUrls: ReadonlyArray<string>,
  hints: ReadonlyArray<RelayHealthHint> = [],
): UseRelayPrimarySelectionResult => {
  const prevUrlsKeyRef = useRef<string>("");
  const [selection, setSelection] = useState<RelayPrimarySelection>(() =>
    resolveInitialRelaySelection(orderedEnabledUrls, hints)
  );

  const urlsKey = orderedEnabledUrls.join("|");

  useEffect(() => {
    if (urlsKey === prevUrlsKeyRef.current) {
      return;
    }
    prevUrlsKeyRef.current = urlsKey;
    setSelection((prev) => {
      const next = resolveInitialRelaySelection(orderedEnabledUrls, hints);
      if (next.primaryUrl === prev.primaryUrl) {
        return prev;
      }
      return next;
    });
  // hints intentionally excluded — only re-run when the URL list changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlsKey]);

  const triggerFailover = useCallback(
    (currentHints?: ReadonlyArray<RelayHealthHint>) => {
      setSelection((prev) => {
        const next = resolveFailoverRelaySelection(
          prev,
          orderedEnabledUrls,
          currentHints ?? hints,
        );
        if (next.primaryUrl === prev.primaryUrl) {
          return prev;
        }
        console.info(
          `[relay-primary] Failover: ${prev.primaryUrl ?? "none"} → ${next.primaryUrl ?? "none"}`,
        );
        return next;
      });
    },
    // orderedEnabledUrls and hints are stable arrays from parent memos
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [urlsKey],
  );

  const setPrimaryManual = useCallback((url: string) => {
    setSelection((prev) => {
      if (!orderedEnabledUrls.includes(url)) {
        return prev;
      }
      if (prev.primaryUrl === url) {
        return prev;
      }
      console.info(`[relay-primary] Manual switch → ${url}`);
      const entries = orderedEnabledUrls.map((u) => ({
        url: u,
        role: (u === url ? "primary" : "standby") as "primary" | "standby",
      }));
      return {
        primaryUrl: url,
        standbyUrls: orderedEnabledUrls.filter((u) => u !== url),
        entries,
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlsKey]);

  return { selection, triggerFailover, setPrimaryManual };
};
