"use client";

import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";

type RequestEventTombstoneState = Readonly<{
  eventIds: ReadonlyArray<string>;
}>;

const STORAGE_KEY = "obscur.messaging.request_event_tombstones.v1";
const MAX_EVENT_IDS = 256;

const resolveStorageKey = (profileId?: string): string => (
  getScopedStorageKey(STORAGE_KEY, profileId ?? getResolvedProfileId())
);

const createEmptyState = (): RequestEventTombstoneState => ({
  eventIds: [],
});

const readState = (profileId?: string): RequestEventTombstoneState => {
  if (typeof window === "undefined") {
    return createEmptyState();
  }
  try {
    const raw = window.localStorage.getItem(resolveStorageKey(profileId));
    if (!raw) {
      return createEmptyState();
    }
    const parsed = JSON.parse(raw) as RequestEventTombstoneState;
    if (!parsed || !Array.isArray(parsed.eventIds)) {
      return createEmptyState();
    }
    return {
      eventIds: parsed.eventIds.filter((eventId): eventId is string => typeof eventId === "string" && eventId.trim().length > 0),
    };
  } catch {
    return createEmptyState();
  }
};

const writeState = (state: RequestEventTombstoneState, profileId?: string): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(resolveStorageKey(profileId), JSON.stringify(state));
  } catch {
    // Keep request handling non-throwing on storage failures.
  }
};

const suppress = (eventId: string | null | undefined, profileId?: string): void => {
  if (!eventId || eventId.trim().length === 0) {
    return;
  }
  const state = readState(profileId);
  if (state.eventIds.includes(eventId)) {
    return;
  }
  writeState({
    eventIds: [...state.eventIds, eventId].slice(-MAX_EVENT_IDS),
  }, profileId);
};

const isSuppressed = (eventId: string | null | undefined, profileId?: string): boolean => {
  if (!eventId || eventId.trim().length === 0) {
    return false;
  }
  return readState(profileId).eventIds.includes(eventId);
};

const clear = (profileId?: string): void => {
  writeState(createEmptyState(), profileId);
};

export const requestEventTombstoneStore = {
  suppress,
  isSuppressed,
  clear,
};

export const requestEventTombstoneStoreInternals = {
  readState,
  writeState,
  STORAGE_KEY,
  MAX_EVENT_IDS,
};
