"use client";

import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import type { ResolvedIdentity } from "@/app/features/search/types/discovery";
import { discoveryCache } from "./discovery-cache";

type CacheState = Readonly<{
  version: 1;
  entries: ReadonlyArray<ResolvedIdentity & Readonly<{ updatedAtUnixMs: number }>>;
}>;

const getStorageKey = (): string => getScopedStorageKey("obscur.discovery.resolved_identity_cache.v1");
const getMigrationMarkerKey = (): string => getScopedStorageKey("obscur.discovery.resolved_identity_cache.migrated.v1");
const MAX_ENTRIES = 300;

const readState = (): CacheState => {
  if (typeof window === "undefined") {
    return { version: 1, entries: [] };
  }
  try {
    const raw = window.localStorage.getItem(getStorageKey());
    if (!raw) return { version: 1, entries: [] };
    const parsed = JSON.parse(raw) as CacheState;
    if (parsed?.version !== 1 || !Array.isArray(parsed.entries)) {
      return { version: 1, entries: [] };
    }
    return parsed;
  } catch {
    return { version: 1, entries: [] };
  }
};

const writeState = (state: CacheState): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(getStorageKey(), JSON.stringify(state));
  } catch {
    // Ignore local cache write failures.
  }
};

const upsert = (identity: ResolvedIdentity): void => {
  const state = readState();
  const now = Date.now();
  const existing = state.entries.filter((entry) => entry.pubkey !== identity.pubkey);
  const next = [{ ...identity, updatedAtUnixMs: now }, ...existing].slice(0, MAX_ENTRIES);
  writeState({ version: 1, entries: next });
};

const getByPubkey = (pubkey: string): ResolvedIdentity | null => {
  const state = readState();
  const matched = state.entries.find((entry) => entry.pubkey === pubkey);
  if (!matched) return null;
  return {
    pubkey: matched.pubkey,
    display: matched.display,
    relays: matched.relays,
    inviteCode: matched.inviteCode,
    source: matched.source,
    confidence: matched.confidence,
  };
};

const getByLegacyInviteCode = (inviteCode: string): ResolvedIdentity | null => {
  const normalized = inviteCode.trim().toUpperCase();
  const state = readState();
  const matched = state.entries.find((entry) => (entry.inviteCode ?? "").toUpperCase() === normalized);
  if (matched) {
    return {
      pubkey: matched.pubkey,
      display: matched.display,
      relays: matched.relays,
      inviteCode: matched.inviteCode,
      source: matched.source,
      confidence: matched.confidence,
    };
  }
  const cachedProfile = discoveryCache.resolveInviteCode(normalized);
  if (!cachedProfile) return null;
  return {
    pubkey: cachedProfile.pubkey,
    display: cachedProfile.displayName || cachedProfile.name,
    inviteCode: cachedProfile.inviteCode,
    source: "legacy_code",
    confidence: "cached_only",
  };
};

const runOneTimeMigration = (): void => {
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem(getMigrationMarkerKey()) === "1") return;
  try {
    const seedEntries: ResolvedIdentity[] = discoveryCache.getProfiles(120).map((profile) => ({
      pubkey: profile.pubkey,
      display: profile.displayName || profile.name,
      inviteCode: profile.inviteCode,
      source: profile.inviteCode ? "legacy_code" : "text",
      confidence: "cached_only",
    }));
    seedEntries.forEach(upsert);
  } finally {
    window.localStorage.setItem(getMigrationMarkerKey(), "1");
  }
};

export const resolvedIdentityCache = {
  upsert,
  getByPubkey,
  getByLegacyInviteCode,
  runOneTimeMigration,
};

export const resolvedIdentityCacheInternals = {
  getStorageKey,
  getMigrationMarkerKey,
};
