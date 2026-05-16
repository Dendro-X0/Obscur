"use client";

import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";

type FailedIncomingEventState = Readonly<{
  eventIds: ReadonlyArray<string>;
}>;

const STORAGE_KEY = "obscur.messaging.failed_incoming_events.v1";
const MAX_EVENT_IDS = 512;

const resolveStorageKey = (profileId?: string): string => (
  getScopedStorageKey(STORAGE_KEY, profileId ?? getResolvedProfileId())
);

const createEmptyState = (): FailedIncomingEventState => ({ eventIds: [] });

const readState = (profileId?: string): FailedIncomingEventState => {
  if (typeof window === "undefined") {
    return createEmptyState();
  }
  try {
    const raw = window.localStorage.getItem(resolveStorageKey(profileId));
    if (!raw) {
      return createEmptyState();
    }
    const parsed = JSON.parse(raw) as FailedIncomingEventState;
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

const writeState = (state: FailedIncomingEventState, profileId?: string): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(resolveStorageKey(profileId), JSON.stringify(state));
  } catch {
    // Keep incoming-event handling non-throwing on storage failure.
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

export const failedIncomingEventStore = {
  suppress,
  isSuppressed,
  clear,
};

export const failedIncomingEventStoreInternals = {
  readState,
  writeState,
  STORAGE_KEY,
  MAX_EVENT_IDS,
};
