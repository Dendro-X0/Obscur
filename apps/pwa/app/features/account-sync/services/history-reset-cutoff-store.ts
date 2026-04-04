"use client";

import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";

const STORAGE_KEY = "obscur.account_sync.history_reset_cutoff.v1";

const toScopedKey = (profileId: string): string => getScopedStorageKey(STORAGE_KEY, profileId);

export const readHistoryResetCutoffUnixMs = (profileId: string): number | null => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(toScopedKey(profileId));
    if (!raw) {
      return null;
    }
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
};

export const writeHistoryResetCutoffUnixMs = (
  profileId: string,
  cutoffUnixMs: number = Date.now(),
): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(toScopedKey(profileId), `${Math.max(0, Math.floor(cutoffUnixMs))}`);
  } catch {
    // Keep reset flow non-throwing if storage is unavailable.
  }
};

export const clearHistoryResetCutoffUnixMs = (profileId: string): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.removeItem(toScopedKey(profileId));
  } catch {
    // Best effort.
  }
};

export const historyResetCutoffStoreInternals = {
  STORAGE_KEY,
  toScopedKey,
};
