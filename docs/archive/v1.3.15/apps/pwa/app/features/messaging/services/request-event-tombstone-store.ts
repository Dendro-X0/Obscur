"use client";

import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";

type RequestEventTombstoneState = Readonly<{
  eventIds: ReadonlyArray<string>;
}>;

const STORAGE_KEY = "obscur.messaging.request_event_tombstones.v1";
const MAX_EVENT_IDS = 256;

const createEmptyState = (): RequestEventTombstoneState => ({
  eventIds: [],
});

const readState = (): RequestEventTombstoneState => {
  if (typeof window === "undefined") {
    return createEmptyState();
  }
  try {
    const raw = window.localStorage.getItem(getScopedStorageKey(STORAGE_KEY));
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

const writeState = (state: RequestEventTombstoneState): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(getScopedStorageKey(STORAGE_KEY), JSON.stringify(state));
  } catch {
    // Keep request handling non-throwing on storage failures.
  }
};

const suppress = (eventId: string | null | undefined): void => {
  if (!eventId || eventId.trim().length === 0) {
    return;
  }
  const state = readState();
  if (state.eventIds.includes(eventId)) {
    return;
  }
  writeState({
    eventIds: [...state.eventIds, eventId].slice(-MAX_EVENT_IDS),
  });
};

const isSuppressed = (eventId: string | null | undefined): boolean => {
  if (!eventId || eventId.trim().length === 0) {
    return false;
  }
  return readState().eventIds.includes(eventId);
};

const clear = (): void => {
  writeState(createEmptyState());
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
