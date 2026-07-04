/**
 * relay-primary-selector.ts
 *
 * Pure service that decides which relay URL is the current primary and which
 * are on standby.  No React, no side-effects.
 */

import type { RelayTransportMode } from "./relay-transport-mode";
import { REDUNDANCY_POOL_MAX_RELAYS } from "./relay-transport-mode";
import { isLocalDevWorkspaceRelayUrl } from "./relay-transport-scope";

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
  isWritable?: boolean;
  isCircuitOpen?: boolean;
  listIndex?: number;
  latencyMs?: number;
  successRate?: number;
}>;

const POSITION_SCORE_WEIGHT = 0.08;
const SCORE_SWITCH_THRESHOLD = 0.15;
const RECONCILE_SCORE_DELTA = 0.12;

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

const findHint = (
  url: string,
  hints: ReadonlyArray<RelayHealthHint>,
): RelayHealthHint | undefined => hints.find((hint) => hint.url === url);

const listIndexFor = (
  url: string,
  orderedEnabledUrls: ReadonlyArray<string>,
  hints: ReadonlyArray<RelayHealthHint>,
): number => {
  const hintIndex = findHint(url, hints)?.listIndex;
  if (typeof hintIndex === "number") {
    return hintIndex;
  }
  const position = orderedEnabledUrls.indexOf(url);
  return position >= 0 ? position : Number.MAX_SAFE_INTEGER;
};

/** Higher is better. Circuit-open relays score 0. */
export const scoreRelayUrl = (
  url: string,
  hints: ReadonlyArray<RelayHealthHint>,
  orderedEnabledUrls: ReadonlyArray<string> = [],
): number => {
  const hint = findHint(url, hints);
  if (!hint || hint.isCircuitOpen) {
    return 0;
  }
  if (!hint.isOpen && !hint.isWritable) {
    return 0;
  }
  const latencyScore = typeof hint.latencyMs === "number" && hint.latencyMs > 0
    ? Math.max(0, 1 - hint.latencyMs / 3000)
    : 0.35;
  const successScore = typeof hint.successRate === "number"
    ? Math.max(0, Math.min(1, hint.successRate / 100))
    : 0.45;
  const writableBonus = hint.isWritable ? 0.35 : 0;
  const openBonus = hint.isOpen ? 0.15 : 0;
  const positionBonus = orderedEnabledUrls.length > 0
    ? Math.max(0, (orderedEnabledUrls.length - listIndexFor(url, orderedEnabledUrls, hints)) / orderedEnabledUrls.length)
      * POSITION_SCORE_WEIGHT
    : 0;
  return (successScore * 0.45) + (latencyScore * 0.25) + writableBonus + openBonus + positionBonus;
};

export const pickBestRelayUrl = (
  orderedEnabledUrls: ReadonlyArray<string>,
  hints: ReadonlyArray<RelayHealthHint> = [],
  options?: Readonly<{ excludeUrls?: ReadonlyArray<string> }>,
): string | null => {
  if (orderedEnabledUrls.length === 0) {
    return null;
  }
  const excluded = new Set(options?.excludeUrls ?? []);
  const candidates = orderedEnabledUrls.filter((url) => !excluded.has(url));
  if (candidates.length === 0) {
    return orderedEnabledUrls[0] ?? null;
  }
  const scored = candidates
    .map((url) => ({
      url,
      score: scoreRelayUrl(url, hints, orderedEnabledUrls),
      listIndex: listIndexFor(url, orderedEnabledUrls, hints),
    }))
    .sort((a, b) => (
      b.score - a.score
      || a.listIndex - b.listIndex
    ));
  const bestScored = scored.find((entry) => entry.score > 0);
  if (bestScored) {
    return bestScored.url;
  }
  const nonLocalDev = candidates.filter((url) => !isLocalDevWorkspaceRelayUrl(url));
  if (nonLocalDev.length > 0) {
    return nonLocalDev[0] ?? null;
  }
  return candidates[0] ?? null;
};

export const resolveInitialRelaySelection = (
  orderedEnabledUrls: ReadonlyArray<string>,
  hints: ReadonlyArray<RelayHealthHint> = [],
): RelayPrimarySelection => {
  if (orderedEnabledUrls.length === 0) {
    return { primaryUrl: null, standbyUrls: [], entries: [] };
  }
  const best = pickBestRelayUrl(orderedEnabledUrls, hints) ?? orderedEnabledUrls[0];
  return buildSelection(orderedEnabledUrls, best);
};

export const resolveFailoverRelaySelection = (
  current: RelayPrimarySelection,
  orderedEnabledUrls: ReadonlyArray<string>,
  hints: ReadonlyArray<RelayHealthHint> = [],
): RelayPrimarySelection => {
  const next = pickBestRelayUrl(orderedEnabledUrls, hints, {
    excludeUrls: current.primaryUrl ? [current.primaryUrl] : [],
  });
  if (!next || next === current.primaryUrl) {
    return current;
  }
  return buildSelection(orderedEnabledUrls, next);
};

/**
 * Re-evaluates primary when health hints change (circuit open, better writable peer).
 * Returns null when the current primary should stay.
 */
export const reconcilePrimarySelection = (
  current: RelayPrimarySelection,
  orderedEnabledUrls: ReadonlyArray<string>,
  hints: ReadonlyArray<RelayHealthHint>,
): RelayPrimarySelection | null => {
  if (!current.primaryUrl || orderedEnabledUrls.length === 0) {
    const initial = resolveInitialRelaySelection(orderedEnabledUrls, hints);
    return initial.primaryUrl === current.primaryUrl ? null : initial;
  }
  const currentHint = findHint(current.primaryUrl, hints);
  const best = pickBestRelayUrl(orderedEnabledUrls, hints);
  if (!best || best === current.primaryUrl) {
    return null;
  }
  if (currentHint?.isCircuitOpen) {
    return buildSelection(orderedEnabledUrls, best);
  }
  if (!currentHint?.isWritable && findHint(best, hints)?.isWritable) {
    return buildSelection(orderedEnabledUrls, best);
  }
  if (!currentHint?.isOpen && findHint(best, hints)?.isOpen) {
    return buildSelection(orderedEnabledUrls, best);
  }
  const currentScore = scoreRelayUrl(current.primaryUrl, hints, orderedEnabledUrls);
  const bestScore = scoreRelayUrl(best, hints, orderedEnabledUrls);
  if (bestScore > currentScore + RECONCILE_SCORE_DELTA) {
    return buildSelection(orderedEnabledUrls, best);
  }
  return null;
};

export const resolveActivePoolRelayUrls = (params: Readonly<{
  mode: RelayTransportMode;
  orderedEnabledUrls: ReadonlyArray<string>;
  selection: RelayPrimarySelection;
  hints?: ReadonlyArray<RelayHealthHint>;
  maxRedundancy?: number;
}>): ReadonlyArray<string> => {
  const hints = params.hints ?? [];
  if (params.orderedEnabledUrls.length === 0) {
    return [];
  }
  if (params.mode === "basic") {
    const primary = params.selection.primaryUrl ?? params.orderedEnabledUrls[0];
    return primary ? [primary] : [];
  }

  const maxRelays = params.maxRedundancy ?? REDUNDANCY_POOL_MAX_RELAYS;
  const scored = params.orderedEnabledUrls
    .map((url) => ({
      url,
      score: scoreRelayUrl(url, hints, params.orderedEnabledUrls),
      listIndex: listIndexFor(url, params.orderedEnabledUrls, hints),
      isCircuitOpen: findHint(url, hints)?.isCircuitOpen ?? false,
    }))
    .filter((entry) => !entry.isCircuitOpen)
    .sort((a, b) => b.score - a.score || a.listIndex - b.listIndex);

  const poolUrls = scored
    .filter((entry) => entry.score > 0)
    .slice(0, maxRelays)
    .map((entry) => entry.url);

  if (poolUrls.length > 0) {
    const primary = params.selection.primaryUrl;
    if (primary && poolUrls.includes(primary)) {
      return [primary, ...poolUrls.filter((url) => url !== primary)];
    }
    return poolUrls;
  }

  return params.orderedEnabledUrls.slice(0, maxRelays);
};

export const resolveStandbyProbeUrls = (params: Readonly<{
  orderedEnabledUrls: ReadonlyArray<string>;
  activePoolUrls: ReadonlyArray<string>;
}>): ReadonlyArray<string> => {
  const active = new Set(params.activePoolUrls);
  return params.orderedEnabledUrls.filter((url) => !active.has(url));
};

export const relaySelectorInternals = {
  buildSelection,
  SCORE_SWITCH_THRESHOLD,
};
