/**
 * relay-primary-selector.ts
 *
 * Pure service that decides which relay URL is the current primary and which
 * are on standby.  No React, no side-effects.
 */

import type { RelayTransportMode } from "./relay-transport-mode";
import { REDUNDANCY_POOL_MAX_RELAYS } from "./relay-transport-mode";
import { isLocalDevWorkspaceRelayUrl } from "./relay-transport-scope";
import { workspaceRelayUrlsMatch } from "@/app/features/groups/services/workspace-relay-url";

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
): RelayHealthHint | undefined => (
  hints.find((hint) => hint.url === url || workspaceRelayUrlsMatch(hint.url, url))
);

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

const isCircuitOpenHint = (
  url: string,
  hints: ReadonlyArray<RelayHealthHint>,
): boolean => findHint(url, hints)?.isCircuitOpen ?? false;

/** Remote interaction URLs — public Nostr / VPS. Local lab mesh is excluded. */
const isRemoteInteractionRelayUrl = (url: string): boolean => (
  !isLocalDevWorkspaceRelayUrl(url)
);

/**
 * E3/P6: dial preference order from probe/health hints.
 * Does not mutate Settings list order — used only when choosing dial membership.
 */
export const rankEnabledRelayUrlsForDial = (
  orderedEnabledUrls: ReadonlyArray<string>,
  hints: ReadonlyArray<RelayHealthHint> = [],
): ReadonlyArray<string> => (
  [...orderedEnabledUrls].sort((a, b) => {
    const scoreDiff = scoreRelayUrl(b, hints, orderedEnabledUrls) - scoreRelayUrl(a, hints, orderedEnabledUrls);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }
    return listIndexFor(a, orderedEnabledUrls, hints) - listIndexFor(b, orderedEnabledUrls, hints);
  })
);

const collectRemoteDialUrls = (
  orderedEnabledUrls: ReadonlyArray<string>,
  hints: ReadonlyArray<RelayHealthHint>,
): ReadonlyArray<string> => {
  const remotes = orderedEnabledUrls.filter((url) => (
    isRemoteInteractionRelayUrl(url) && !isCircuitOpenHint(url, hints)
  ));
  return rankEnabledRelayUrlsForDial(remotes, hints);
};

/**
 * E2c: local lab may stay in the pool, but must not be the sole dialed member
 * when remote (public/VPS) URLs are enabled.
 */
const ensureRemoteDialMembership = (
  pool: ReadonlyArray<string>,
  orderedEnabledUrls: ReadonlyArray<string>,
  hints: ReadonlyArray<RelayHealthHint>,
  maxRelays: number,
): ReadonlyArray<string> => {
  const remotes = collectRemoteDialUrls(orderedEnabledUrls, hints);
  if (remotes.length === 0) {
    return pool;
  }
  if (pool.some((url) => isRemoteInteractionRelayUrl(url))) {
    return pool;
  }
  const remote = remotes[0];
  if (!remote) {
    return pool;
  }
  if (pool.length < maxRelays) {
    return [...pool, remote];
  }
  const next = [...pool];
  const localIndex = next.findIndex((url) => isLocalDevWorkspaceRelayUrl(url));
  if (localIndex >= 0) {
    next[localIndex] = remote;
    return next;
  }
  next[next.length - 1] = remote;
  return next;
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
    if (!primary) {
      return [];
    }
    const primaryHint = findHint(primary, hints);
    const primaryLive = Boolean(primaryHint?.isOpen || primaryHint?.isWritable);
    if (primaryLive || hints.length === 0) {
      return [primary];
    }
    // Promote connected standby into the active pool when the primary has zero open sockets
    // so recovery metrics/writable counts are not scoped to a dead public primary alone.
    const bestOpen = pickBestRelayUrl(params.orderedEnabledUrls, hints);
    if (
      bestOpen
      && bestOpen !== primary
      && (findHint(bestOpen, hints)?.isOpen || findHint(bestOpen, hints)?.isWritable)
    ) {
      // E2c: local lab alone is not enough for remote interaction — keep dialing remotes.
      if (isLocalDevWorkspaceRelayUrl(bestOpen)) {
        const remotes = collectRemoteDialUrls(params.orderedEnabledUrls, hints);
        if (remotes.length > 0) {
          const primaryIsRemote = isRemoteInteractionRelayUrl(primary);
          const seed = primaryIsRemote ? [primary, bestOpen] : [bestOpen];
          const padded = [...seed];
          for (const url of remotes) {
            if (padded.length >= 3) {
              break;
            }
            if (padded.some((entry) => workspaceRelayUrlsMatch(entry, url))) {
              continue;
            }
            padded.push(url);
          }
          return padded;
        }
      }
      return [bestOpen];
    }
    // E2: pad one cold standby into the dial set so basic mode can open a socket
    // for failover (standbys previously stayed forever DISCONNECTED / never dialed).
    // E3/P6: prefer probe-healthy standbys over static list order.
    const padCandidates = params.orderedEnabledUrls.filter((url) => {
      if (url === primary || workspaceRelayUrlsMatch(url, primary)) {
        return false;
      }
      return !isCircuitOpenHint(url, hints);
    });
    const nextStandby = pickBestRelayUrl(padCandidates, hints) ?? padCandidates[0];
    if (nextStandby) {
      return [primary, nextStandby];
    }
    return [primary];
  }

  const maxRelays = params.maxRedundancy ?? REDUNDANCY_POOL_MAX_RELAYS;
  const dialOrder = rankEnabledRelayUrlsForDial(params.orderedEnabledUrls, hints);

  const scored = dialOrder
    .filter((url) => !isCircuitOpenHint(url, hints))
    .map((url) => ({
      url,
      score: scoreRelayUrl(url, hints, params.orderedEnabledUrls),
      listIndex: listIndexFor(url, params.orderedEnabledUrls, hints),
    }))
    .sort((a, b) => b.score - a.score || a.listIndex - b.listIndex);

  // Prefer healthy/scored members, then pad with remaining enabled URLs so cold
  // standbys still receive sockets (R-RELAY-1). Previously score>0-only left a
  // flapping primary as the sole pool member while standbys never connected.
  // E3/P6: cold pad follows probe-rank dial order, not raw Settings order.
  const pool: string[] = [];
  for (const entry of scored) {
    if (entry.score > 0 && pool.length < maxRelays) {
      pool.push(entry.url);
    }
  }
  for (const url of dialOrder) {
    if (pool.length >= maxRelays) {
      break;
    }
    if (isCircuitOpenHint(url, hints) || pool.includes(url)) {
      continue;
    }
    pool.push(url);
  }

  const withRemote = ensureRemoteDialMembership(pool, params.orderedEnabledUrls, hints, maxRelays);

  const primary = params.selection.primaryUrl;
  if (primary && withRemote.includes(primary)) {
    return [primary, ...withRemote.filter((url) => url !== primary)];
  }
  return withRemote;
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
  collectRemoteDialUrls,
  rankEnabledRelayUrlsForDial,
};
