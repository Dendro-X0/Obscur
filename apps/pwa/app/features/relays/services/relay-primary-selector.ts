/**
 * relay-primary-selector.ts
 *
 * Pure service that decides which relay URL is the current primary and which
 * are on standby.  No React, no side-effects.
 *
 * Design:
 *  - One primary relay handles all publish + subscribe traffic.
 *  - Standby relays are tracked for health but hold zero REQ subscriptions.
 *  - When the primary is declared failed the selector promotes the best
 *    standby and returns a new selection.
 *  - User-defined order (position in the list) is the tie-breaker when
 *    health scores are equal, so the first enabled relay in settings is
 *    preferred.
 */

export type RelayRole = "primary" | "standby" | "disabled";

export type RelaySelectionEntry = Readonly<{
  url: string;
  role: RelayRole;
}>;

export type RelayPrimarySelection = Readonly<{
  primaryUrl: string | null;
  standbyUrls: ReadonlyArray<string>;
  entries: ReadonlyArray<RelaySelectionEntry>;
}>;

export type RelayHealthHint = Readonly<{
  url: string;
  isOpen: boolean;
  latencyMs?: number;
  successRate?: number;
}>;

const buildSelection = (
  orderedEnabledUrls: ReadonlyArray<string>,
  primaryUrl: string | null,
): RelayPrimarySelection => {
  if (orderedEnabledUrls.length === 0) {
    return { primaryUrl: null, standbyUrls: [], entries: [] };
  }
  const resolved = primaryUrl && orderedEnabledUrls.includes(primaryUrl)
    ? primaryUrl
    : orderedEnabledUrls[0];
  const standbyUrls = orderedEnabledUrls.filter((u) => u !== resolved);
  const entries: RelaySelectionEntry[] = orderedEnabledUrls.map((url) => ({
    url,
    role: url === resolved ? "primary" : "standby",
  }));
  return { primaryUrl: resolved ?? null, standbyUrls, entries };
};

const scoreUrl = (url: string, hints: ReadonlyArray<RelayHealthHint>): number => {
  const hint = hints.find((h) => h.url === url);
  if (!hint) return 0;
  if (!hint.isOpen) return 0;
  const latencyScore = typeof hint.latencyMs === "number" && hint.latencyMs > 0
    ? Math.max(0, 1 - hint.latencyMs / 3000)
    : 0.5;
  const successScore = typeof hint.successRate === "number"
    ? Math.max(0, Math.min(1, hint.successRate / 100))
    : 0.5;
  return (successScore * 0.6) + (latencyScore * 0.4);
};

/**
 * Given the user's ordered enabled relay list and current health hints,
 * returns the initial selection (no previous primary assumed).
 *
 * The first enabled relay in the list wins by position unless health scores
 * favour another.  A relay must be "open" to be considered for primary.
 */
export const resolveInitialRelaySelection = (
  orderedEnabledUrls: ReadonlyArray<string>,
  hints: ReadonlyArray<RelayHealthHint> = [],
): RelayPrimarySelection => {
  if (orderedEnabledUrls.length === 0) {
    return { primaryUrl: null, standbyUrls: [], entries: [] };
  }
  if (hints.length === 0) {
    return buildSelection(orderedEnabledUrls, orderedEnabledUrls[0]);
  }
  const openUrls = orderedEnabledUrls.filter((url) => hints.find((h) => h.url === url)?.isOpen);
  if (openUrls.length === 0) {
    return buildSelection(orderedEnabledUrls, orderedEnabledUrls[0]);
  }
  const best = openUrls.reduce((acc, url) => {
    const accScore = scoreUrl(acc, hints);
    const urlScore = scoreUrl(url, hints);
    if (urlScore > accScore + 0.15) return url;
    return acc;
  }, openUrls[0]);
  return buildSelection(orderedEnabledUrls, best ?? orderedEnabledUrls[0]);
};

/**
 * Called when the primary relay has failed (no writable relays, watchdog fired).
 * Promotes the best standby to primary.  Returns null if no standby is available.
 */
export const resolveFailoverRelaySelection = (
  current: RelayPrimarySelection,
  orderedEnabledUrls: ReadonlyArray<string>,
  hints: ReadonlyArray<RelayHealthHint> = [],
): RelayPrimarySelection => {
  const candidates = orderedEnabledUrls.filter((url) => url !== current.primaryUrl);
  if (candidates.length === 0) {
    return current;
  }
  const openCandidates = candidates.filter((url) => hints.find((h) => h.url === url)?.isOpen);
  const pool = openCandidates.length > 0 ? openCandidates : candidates;
  const next = pool.reduce((acc, url) => {
    const accScore = scoreUrl(acc, hints);
    const urlScore = scoreUrl(url, hints);
    if (urlScore > accScore) return url;
    return acc;
  }, pool[0]);
  return buildSelection(orderedEnabledUrls, next ?? candidates[0]);
};

export const relaySelectorInternals = {
  buildSelection,
  scoreUrl,
};
