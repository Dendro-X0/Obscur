"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { NostrFilter } from "@/app/features/relays/types/nostr-filter";
import { cryptoService } from "@/app/features/crypto/crypto-service";
import { logRuntimeEvent } from "@/app/shared/runtime-log-classification";
import { discoveryCache } from "@/app/features/search/services/discovery-cache";
import { isDeletedAccountProfile } from "@/app/features/profile/utils/deleted-profile";
import {
  buildPresenceUnsignedEvent,
  isPresenceRecordOnline,
  parsePresenceEvent,
  PRESENCE_D_TAG,
  PRESENCE_EVENT_KIND,
  PRESENCE_HEARTBEAT_INTERVAL_MS,
  shouldRejectSessionAsDuplicate,
  type PresenceRecord,
  type PresenceState,
} from "../services/realtime-presence";

type PresenceByPubkey = Readonly<Record<string, PresenceRecord>>;

type UseRealtimePresenceParams = Readonly<{
  publicKeyHex: PublicKeyHex | null;
  privateKeyHex: PrivateKeyHex | null;
  acceptedPeers: ReadonlyArray<PublicKeyHex>;
  relayPool: Readonly<{
    subscribe: (filters: ReadonlyArray<NostrFilter>, onEvent: (event: unknown, url: string) => void) => string;
    unsubscribe: (id: string) => void;
    publishToAll: (payload: string) => Promise<unknown>;
  }>;
  onDuplicateSessionConflict?: (record: PresenceRecord) => void;
}>;

type UseRealtimePresenceResult = Readonly<{
  presenceByPubkey: PresenceByPubkey;
  isPeerOnline: (publicKeyHex: PublicKeyHex) => boolean;
  getLastSeenAtMs: (publicKeyHex: PublicKeyHex) => number | null;
  selfSessionId: string;
  selfStartedAtMs: number;
}>;

const STALE_PRUNE_INTERVAL_MS = 10_000;

const createSessionId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

const toSortedUniqueAuthors = (self: PublicKeyHex | null, peers: ReadonlyArray<PublicKeyHex>): ReadonlyArray<string> => {
  const values = new Set<string>(peers);
  if (self) {
    values.add(self);
  }
  return Array.from(values).sort();
};

const isRecordNewerThan = (incoming: PresenceRecord, existing: PresenceRecord | undefined): boolean => {
  if (!existing) {
    return true;
  }
  if (incoming.eventCreatedAtMs !== existing.eventCreatedAtMs) {
    return incoming.eventCreatedAtMs > existing.eventCreatedAtMs;
  }
  if (incoming.issuedAtMs !== existing.issuedAtMs) {
    return incoming.issuedAtMs > existing.issuedAtMs;
  }
  if (incoming.startedAtMs !== existing.startedAtMs) {
    return incoming.startedAtMs > existing.startedAtMs;
  }
  return incoming.sessionId > existing.sessionId;
};

const isPeerDeletedByCachedProfile = (publicKeyHex: string): boolean => {
  const cached = discoveryCache.getProfile(publicKeyHex);
  if (!cached) {
    return false;
  }
  return isDeletedAccountProfile({
    displayName: cached.displayName ?? cached.name,
    about: cached.about,
  });
};

export const useRealtimePresence = (params: UseRealtimePresenceParams): UseRealtimePresenceResult => {
  const [presenceByPubkey, setPresenceByPubkey] = useState<PresenceByPubkey>({});
  const [clockNowMs, setClockNowMs] = useState<number>(() => Date.now());
  const duplicateSessionDetectedRef = useRef<boolean>(false);
  const duplicateSessionConflictHandlerRef = useRef<typeof params.onDuplicateSessionConflict>(params.onDuplicateSessionConflict);
  const subscribeFn = params.relayPool.subscribe;
  const unsubscribeFn = params.relayPool.unsubscribe;
  const publishToAll = params.relayPool.publishToAll;
  const selfSessionId = useMemo(() => createSessionId(), []);
  const [selfStartedAtMs] = useState<number>(() => Date.now());

  // Use race-safe subscription state computation
  // Ref: presence-subscription-race-fix.ts for pure implementation
  const subscriptionState = useMemo(() => {
    const authors = toSortedUniqueAuthors(params.publicKeyHex, params.acceptedPeers);
    return {
      authors,
      key: authors.join("|"),
      hasAuthors: authors.length > 0,
    };
  }, [params.acceptedPeers, params.publicKeyHex]);

  // Keep track of current authors to avoid stale closure in subscription effect
  const currentAuthorsRef = useRef(subscriptionState.authors);
  useEffect(() => {
    currentAuthorsRef.current = subscriptionState.authors;
  }, [subscriptionState.authors]);

  useEffect(() => {
    duplicateSessionDetectedRef.current = false;
  }, [params.publicKeyHex, selfSessionId]);

  useEffect(() => {
    duplicateSessionConflictHandlerRef.current = params.onDuplicateSessionConflict;
  }, [params.onDuplicateSessionConflict]);

  // Filter out presence entries for authors no longer in scope
  useEffect(() => {
    const scopedAuthors = new Set(subscriptionState.authors);
    setPresenceByPubkey((prev) => {
      const entries = Object.entries(prev).filter(([pubkey]) => scopedAuthors.has(pubkey));
      if (entries.length === Object.keys(prev).length) {
        return prev;
      }
      return Object.fromEntries(entries);
    });
  }, [subscriptionState.authors]);

  const publishPresence = useCallback(async (state: PresenceState): Promise<void> => {
    if (!params.publicKeyHex || !params.privateKeyHex) {
      return;
    }
    try {
      const unsigned = buildPresenceUnsignedEvent({
        pubkey: params.publicKeyHex,
        state,
        sessionId: selfSessionId,
        startedAtMs: selfStartedAtMs,
      });
      const signed = await cryptoService.signEvent(unsigned, params.privateKeyHex);
      await publishToAll(JSON.stringify(["EVENT", signed]));
    } catch (error) {
      logRuntimeEvent(
        "network.presence.publish_failed",
        "degraded",
        [error instanceof Error ? error.message : String(error)],
        { maxPerWindow: 2, windowMs: 15_000 }
      );
    }
  }, [params.privateKeyHex, params.publicKeyHex, publishToAll, selfSessionId, selfStartedAtMs]);

  // Subscribe to presence events with race-safe author list
  useEffect(() => {
    if (!params.publicKeyHex || !subscriptionState.hasAuthors) {
      return;
    }

    const selfPublicKeyHex = params.publicKeyHex;
    const authors = currentAuthorsRef.current;
    const filters: ReadonlyArray<NostrFilter> = [{
      kinds: [PRESENCE_EVENT_KIND],
      authors,
      "#d": [PRESENCE_D_TAG],
      limit: 200,
    }];

    const subId = subscribeFn(filters, (candidate) => {
      if (!candidate || typeof candidate !== "object") {
        return;
      }
      const record = parsePresenceEvent(candidate as Parameters<typeof parsePresenceEvent>[0]);
      if (!record) {
        return;
      }

      setPresenceByPubkey((prev) => {
        if (!isRecordNewerThan(record, prev[record.pubkey])) {
          return prev;
        }
        return {
          ...prev,
          [record.pubkey]: record,
        };
      });

      const conflictHandler = duplicateSessionConflictHandlerRef.current;
      if (duplicateSessionDetectedRef.current || !conflictHandler) {
        return;
      }
      if (!shouldRejectSessionAsDuplicate({
        incoming: record,
        selfPublicKeyHex: selfPublicKeyHex,
        selfSessionId,
        selfStartedAtMs,
        nowMs: Date.now(),
      })) {
        return;
      }
      duplicateSessionDetectedRef.current = true;
      conflictHandler(record);
    });

    return () => {
      unsubscribeFn(subId);
    };
  }, [
    params.publicKeyHex,
    selfSessionId,
    selfStartedAtMs,
    subscriptionState.key,
    subscriptionState.hasAuthors,
    subscribeFn,
    unsubscribeFn,
  ]);

  useEffect(() => {
    if (!params.publicKeyHex || !params.privateKeyHex) {
      return;
    }

    void publishPresence("online");
    const intervalId = window.setInterval(() => {
      void publishPresence("online");
    }, PRESENCE_HEARTBEAT_INTERVAL_MS);

    const handleBeforeUnload = (): void => {
      void publishPresence("offline");
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      void publishPresence("offline");
    };
  }, [params.privateKeyHex, params.publicKeyHex, publishPresence]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setClockNowMs(Date.now());
    }, STALE_PRUNE_INTERVAL_MS);
    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const isPeerOnline = useCallback((publicKeyHex: PublicKeyHex): boolean => {
    if (isPeerDeletedByCachedProfile(publicKeyHex)) {
      return false;
    }
    return isPresenceRecordOnline(presenceByPubkey[publicKeyHex], clockNowMs);
  }, [clockNowMs, presenceByPubkey]);

  const getLastSeenAtMs = useCallback((publicKeyHex: PublicKeyHex): number | null => {
    if (isPeerDeletedByCachedProfile(publicKeyHex)) {
      return null;
    }
    const record = presenceByPubkey[publicKeyHex];
    if (!record) {
      return null;
    }
    return record.eventCreatedAtMs;
  }, [presenceByPubkey]);

  return useMemo(() => ({
    presenceByPubkey,
    isPeerOnline,
    getLastSeenAtMs,
    selfSessionId,
    selfStartedAtMs,
  }), [getLastSeenAtMs, isPeerOnline, presenceByPubkey, selfSessionId, selfStartedAtMs]);
};

export const realtimePresenceHookInternals = {
  isPeerDeletedByCachedProfile,
};
