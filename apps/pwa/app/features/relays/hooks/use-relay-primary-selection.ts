"use client";
/**
 * React hook that owns primary/standby selection state.
 *
 * Automatic health reconcile is intentionally **not** done here — that path duplicated
 * relay-runtime-supervisor failover and caused render-depth loops. Supervisor calls
 * `setPrimaryManual` / `attemptPrimaryFailover` as the single automatic owner.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  reconcilePrimarySelection,
  resolveInitialRelaySelection,
  type RelayHealthHint,
  type RelayPrimarySelection,
} from "../services/relay-primary-selector";
import {
  isEmergencyRelayPrimarySwitch,
  shouldAllowRelayPrimarySwitch,
} from "../services/relay-primary-switch-policy";

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
  const manualPrimaryLockRef = useRef<string | null>(null);
  const lastPrimarySwitchAtMsRef = useRef(0);
  const hintsRef = useRef(hints);
  hintsRef.current = hints;
  const [selection, setSelection] = useState<RelayPrimarySelection>(() =>
    resolveInitialRelaySelection(orderedEnabledUrls, hints),
  );

  const urlsKey = orderedEnabledUrls.join("|");

  const applyPrimarySwitch = useCallback((
    prev: RelayPrimarySelection,
    next: RelayPrimarySelection,
    activeHints: ReadonlyArray<RelayHealthHint>,
    logLabel: string,
  ): RelayPrimarySelection => {
    if (next.primaryUrl === prev.primaryUrl) {
      return prev;
    }
    const emergency = isEmergencyRelayPrimarySwitch(prev.primaryUrl, activeHints);
    if (!shouldAllowRelayPrimarySwitch({
      nowUnixMs: Date.now(),
      lastSwitchAtUnixMs: lastPrimarySwitchAtMsRef.current,
      emergency,
    })) {
      return prev;
    }
    lastPrimarySwitchAtMsRef.current = Date.now();
    console.info(
      `[relay-primary] ${logLabel}: ${prev.primaryUrl ?? "none"} → ${next.primaryUrl ?? "none"}`,
    );
    return next;
  }, []);

  useEffect(() => {
    if (urlsKey === prevUrlsKeyRef.current) {
      return;
    }
    prevUrlsKeyRef.current = urlsKey;
    manualPrimaryLockRef.current = null;
    setSelection((prev) => {
      const next = resolveInitialRelaySelection(orderedEnabledUrls, hintsRef.current);
      if (next.primaryUrl === prev.primaryUrl) {
        return prev;
      }
      lastPrimarySwitchAtMsRef.current = Date.now();
      return next;
    });
  }, [urlsKey, orderedEnabledUrls]);

  const triggerFailover = useCallback(
    (currentHints?: ReadonlyArray<RelayHealthHint>) => {
      const activeHints = currentHints ?? hintsRef.current;
      setSelection((prev) => {
        const reconciled = reconcilePrimarySelection(prev, orderedEnabledUrls, activeHints);
        if (!reconciled) {
          return prev;
        }
        manualPrimaryLockRef.current = null;
        return applyPrimarySwitch(prev, reconciled, activeHints, "Failover");
      });
    },
    [orderedEnabledUrls, applyPrimarySwitch],
  );

  const setPrimaryManual = useCallback((url: string) => {
    setSelection((prev) => {
      if (!orderedEnabledUrls.includes(url)) {
        return prev;
      }
      if (prev.primaryUrl === url) {
        return prev;
      }
      const next: RelayPrimarySelection = {
        primaryUrl: url,
        standbyUrls: orderedEnabledUrls.filter((u) => u !== url),
        entries: orderedEnabledUrls.map((u) => ({
          url: u,
          role: (u === url ? "primary" : "standby") as "primary" | "standby",
        })),
      };
      const switched = applyPrimarySwitch(prev, next, hintsRef.current, "Manual switch");
      if (switched.primaryUrl === url) {
        manualPrimaryLockRef.current = url;
      }
      return switched;
    });
  }, [orderedEnabledUrls, applyPrimarySwitch]);

  return { selection, triggerFailover, setPrimaryManual };
};
