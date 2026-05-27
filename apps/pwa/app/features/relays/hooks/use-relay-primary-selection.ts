"use client";
/**
 * React hook that owns primary/standby selection state.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  reconcilePrimarySelection,
  resolveFailoverRelaySelection,
  resolveInitialRelaySelection,
  type RelayHealthHint,
  type RelayPrimarySelection,
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
  hintsSignature = "",
): UseRelayPrimarySelectionResult => {
  const prevUrlsKeyRef = useRef<string>("");
  const manualPrimaryLockRef = useRef<string | null>(null);
  const [selection, setSelection] = useState<RelayPrimarySelection>(() =>
    resolveInitialRelaySelection(orderedEnabledUrls, hints),
  );

  const urlsKey = orderedEnabledUrls.join("|");

  useEffect(() => {
    if (urlsKey === prevUrlsKeyRef.current) {
      return;
    }
    prevUrlsKeyRef.current = urlsKey;
    manualPrimaryLockRef.current = null;
    setSelection((prev) => {
      const next = resolveInitialRelaySelection(orderedEnabledUrls, hints);
      if (next.primaryUrl === prev.primaryUrl) {
        return prev;
      }
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlsKey]);

  useEffect(() => {
    if (!hintsSignature || orderedEnabledUrls.length === 0) {
      return;
    }
    setSelection((prev) => {
      if (manualPrimaryLockRef.current && manualPrimaryLockRef.current === prev.primaryUrl) {
        const lockedHint = hints.find((hint) => hint.url === prev.primaryUrl);
        if (lockedHint?.isWritable || lockedHint?.isOpen) {
          return prev;
        }
        manualPrimaryLockRef.current = null;
      }
      const next = reconcilePrimarySelection(prev, orderedEnabledUrls, hints);
      if (!next || next.primaryUrl === prev.primaryUrl) {
        return prev;
      }
      console.info(
        `[relay-primary] Health reconcile: ${prev.primaryUrl ?? "none"} → ${next.primaryUrl ?? "none"}`,
      );
      return next;
    });
  }, [hintsSignature, orderedEnabledUrls, hints]);

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
        manualPrimaryLockRef.current = null;
        console.info(
          `[relay-primary] Failover: ${prev.primaryUrl ?? "none"} → ${next.primaryUrl ?? "none"}`,
        );
        return next;
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [urlsKey, hintsSignature],
  );

  const setPrimaryManual = useCallback((url: string) => {
    setSelection((prev) => {
      if (!orderedEnabledUrls.includes(url)) {
        return prev;
      }
      if (prev.primaryUrl === url) {
        return prev;
      }
      manualPrimaryLockRef.current = url;
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
