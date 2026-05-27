"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import {
  listCommunityLeaveOutboxItemsAwaitingRelay,
  toCommunityLeaveOutboxItemId,
  type CommunityLeaveOutboxItem,
} from "../services/community-leave-outbox";

const LEAVE_OUTBOX_STORAGE_PREFIX = "obscur.group.leave_outbox.v1";

const toOutboxStorageKey = (publicKeyHex: string, profileId: string): string => (
  getScopedStorageKey(`${LEAVE_OUTBOX_STORAGE_PREFIX}.${publicKeyHex}`, profileId)
);

export const useCommunityLeaveOutboxIndex = (): Readonly<{
  items: ReadonlyArray<CommunityLeaveOutboxItem>;
  byScopeId: ReadonlyMap<string, CommunityLeaveOutboxItem>;
  refresh: () => void;
}> => {
  const { state: identityState } = useIdentity();
  const publicKeyHex = identityState.publicKeyHex?.trim() ?? "";
  const profileId = getResolvedProfileId();
  const [revision, setRevision] = useState(0);

  const refresh = useCallback((): void => {
    setRevision((value) => value + 1);
  }, []);

  useEffect((): (() => void) | void => {
    if (!publicKeyHex || typeof window === "undefined") {
      return;
    }
    const storageKey = toOutboxStorageKey(publicKeyHex, profileId);
    const LEAVE_OUTBOX_POLL_MS = 15_000;
    let intervalId: number | null = null;

    const startPolling = (): void => {
      if (intervalId !== null) {
        return;
      }
      intervalId = window.setInterval(refresh, LEAVE_OUTBOX_POLL_MS);
    };

    const stopPolling = (): void => {
      if (intervalId === null) {
        return;
      }
      window.clearInterval(intervalId);
      intervalId = null;
    };

    const syncPolling = (): void => {
      if (document.visibilityState === "visible") {
        refresh();
        startPolling();
      } else {
        stopPolling();
      }
    };

    syncPolling();
    const onVisibilityChange = (): void => {
      syncPolling();
    };
    const onStorage = (event: StorageEvent): void => {
      if (event.key === storageKey) {
        refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("storage", onStorage);
    return (): void => {
      stopPolling();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("storage", onStorage);
    };
  }, [profileId, publicKeyHex, refresh]);

  const items = useMemo((): ReadonlyArray<CommunityLeaveOutboxItem> => {
    if (!publicKeyHex) {
      return [];
    }
    void revision;
    return listCommunityLeaveOutboxItemsAwaitingRelay(publicKeyHex, profileId);
  }, [profileId, publicKeyHex, revision]);

  const byScopeId = useMemo((): ReadonlyMap<string, CommunityLeaveOutboxItem> => (
    new Map(items.map((item) => [item.id, item]))
  ), [items]);

  return { items, byScopeId, refresh };
};

export const resolveLeaveOutboxScopeId = (
  groupId: string,
  relayUrl: string,
): string => toCommunityLeaveOutboxItemId(groupId, relayUrl);
