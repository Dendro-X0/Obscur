"use client";

import { useEffect, useRef } from "react";
import type { NostrEvent } from "@dweb/nostr/nostr-event";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { toGroupConversationId } from "../utils/group-conversation-id";
import type { CommunityMode } from "../types";
import type { SealedCommunityNostrPool } from "../services/sealed-community-relay-scope";
import {
  buildGroupTimelineSubscriptionFilters,
  ingestSealedCommunityRelayEvent,
} from "../services/group-thread-relay-ingest";

const MAX_RECENT_INGESTED_EVENT_IDS = 400;

export type UseGroupThreadRelayIngestParams = Readonly<{
  pool: SealedCommunityNostrPool;
  relayUrl: string;
  groupId: string;
  communityId?: string;
  communityMode?: CommunityMode;
  myPublicKeyHex: PublicKeyHex | null;
  enabled?: boolean;
}>;

/**
 * Relay subscription owner for group chat ingest.
 * Persists decrypted chat rows via appendGroupThreadMessage (SQLite + thread-history kernel).
 */
export const useGroupThreadRelayIngest = (params: UseGroupThreadRelayIngestParams): void => {
  const recentEventIdsRef = useRef<Map<string, number>>(new Map());

  useEffect((): (() => void) => {
    const groupId = params.groupId.trim();
    const relayUrl = params.relayUrl.trim();
    if (!groupId || !relayUrl || params.enabled === false || !params.myPublicKeyHex) {
      return (): void => {};
    }

    const conversationId = toGroupConversationId({
      groupId,
      relayUrl,
      communityId: params.communityId,
    });
    const profileId = getResolvedProfileId()?.trim() || undefined;
    const context = {
      groupId,
      relayUrl,
      conversationId,
      communityId: params.communityId,
      myPublicKeyHex: params.myPublicKeyHex,
      profileId,
    } as const;

    const onEvent = (event: NostrEvent, url: string): void => {
      const knownAt = recentEventIdsRef.current.get(event.id);
      if (typeof knownAt === "number" && (Date.now() - knownAt) < 5 * 60_000) {
        return;
      }
      recentEventIdsRef.current.set(event.id, Date.now());
      if (recentEventIdsRef.current.size > MAX_RECENT_INGESTED_EVENT_IDS) {
        const cutoff = Date.now() - 5 * 60_000;
        for (const [eventId, observedAt] of recentEventIdsRef.current.entries()) {
          if (observedAt < cutoff) {
            recentEventIdsRef.current.delete(eventId);
          }
        }
      }

      void ingestSealedCommunityRelayEvent(event, url, context).catch(() => {
        // Ingest is best-effort; display authority is sqlite hydrate via useGroupThreadMessages.
      });
    };

    const subscriptionId = params.pool.subscribe(
      buildGroupTimelineSubscriptionFilters(groupId, params.communityMode),
      onEvent,
    );

    return (): void => {
      params.pool.unsubscribe(subscriptionId);
    };
  }, [
    params.communityId,
    params.enabled,
    params.groupId,
    params.myPublicKeyHex,
    params.pool,
    params.relayUrl,
  ]);
};
