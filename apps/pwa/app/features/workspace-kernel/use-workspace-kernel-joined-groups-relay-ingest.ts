"use client";

import { useEffect, useMemo } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { GroupConversation } from "@/app/features/messaging/types";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { hasWritableCommunityRelayTransport } from "@/app/features/groups/services/community-relay-transport";
import {
  buildGroupTimelineSubscriptionFilters,
  ingestSealedCommunityRelayEvent,
} from "@/app/features/groups/services/group-thread-relay-ingest";
import { toGroupConversationId } from "@/app/features/groups/utils/group-conversation-id";
import type { SealedCommunityNostrPool } from "@/app/features/groups/services/sealed-community-relay-scope";
import { COORDINATION_MEMBERSHIP_DIRECTORY_CHANGED_EVENT } from "@/app/features/groups/services/community-coordination-membership-directory-store";
import { COMMUNITY_MEMBERSHIP_LEDGER_UPDATED_EVENT } from "@/app/features/groups/services/community-membership-ledger";
import { loadWorkspaceGroupMetadataRecords } from "./workspace-kernel-group-metadata-store";
import { isWorkspaceKernelAuthority } from "./workspace-kernel-policy";

type SealedCommunityRelayEvent = Parameters<typeof ingestSealedCommunityRelayEvent>[0];

const MAX_RECENT_INGESTED_EVENT_IDS = 400;

const mergeIngestTargets = (
  metadataGroups: ReadonlyArray<GroupConversation>,
  displayGroups: ReadonlyArray<GroupConversation>,
): ReadonlyArray<GroupConversation> => {
  const byId = new Map<string, GroupConversation>();
  for (const group of metadataGroups) {
    byId.set(group.id, group);
  }
  for (const group of displayGroups) {
    byId.set(group.id, group);
  }
  return Array.from(byId.values()).filter((group) => (
    group.communityMode === "managed_workspace"
    && Boolean(group.groupId?.trim())
    && Boolean(group.relayUrl?.trim())
    && hasWritableCommunityRelayTransport(group.relayUrl)
  ));
};

export const useWorkspaceKernelJoinedGroupsRelayIngest = (params: Readonly<{
  pool: SealedCommunityNostrPool;
  myPublicKeyHex: PublicKeyHex | null;
  profileId?: string;
  displayGroups: ReadonlyArray<GroupConversation>;
  metadataCacheEpoch?: number;
  enabled?: boolean;
}>): void => {
  const enabled = params.enabled ?? isWorkspaceKernelAuthority();
  const profileId = params.profileId ?? getResolvedProfileId();
  const metadataGroups = useMemo(() => (
    params.myPublicKeyHex
      ? loadWorkspaceGroupMetadataRecords(params.myPublicKeyHex, profileId)
      : []
  ), [params.displayGroups, params.metadataCacheEpoch, params.myPublicKeyHex, profileId]);

  const ingestTargets = useMemo(
    () => mergeIngestTargets(metadataGroups, params.displayGroups),
    [metadataGroups, params.displayGroups],
  );

  useEffect(() => {
    if (!enabled || !params.myPublicKeyHex || ingestTargets.length === 0) {
      return;
    }

    const recentEventIds = new Map<string, number>();
    const subscriptionIds: string[] = [];

    const onEvent = (group: GroupConversation) => (event: SealedCommunityRelayEvent, url: string): void => {
      const knownAt = recentEventIds.get(event.id);
      if (typeof knownAt === "number" && (Date.now() - knownAt) < 5 * 60_000) {
        return;
      }
      recentEventIds.set(event.id, Date.now());
      if (recentEventIds.size > MAX_RECENT_INGESTED_EVENT_IDS) {
        const cutoff = Date.now() - 5 * 60_000;
        for (const [eventId, observedAt] of recentEventIds.entries()) {
          if (observedAt < cutoff) {
            recentEventIds.delete(eventId);
          }
        }
      }

      const groupId = group.groupId.trim();
      const relayUrl = group.relayUrl.trim();
      const conversationId = toGroupConversationId({
        groupId,
        relayUrl,
        communityId: group.communityId,
      });

      void ingestSealedCommunityRelayEvent(event, url, {
        groupId,
        relayUrl,
        conversationId,
        communityId: group.communityId,
        myPublicKeyHex: params.myPublicKeyHex as PublicKeyHex,
        profileId,
      }).catch(() => {
        // Best-effort background ingest for all joined workspace groups.
      });
    };

    for (const group of ingestTargets) {
      const subscriptionId = params.pool.subscribe(
        buildGroupTimelineSubscriptionFilters(group.groupId, group.communityMode ?? "managed_workspace"),
        onEvent(group),
      );
      subscriptionIds.push(subscriptionId);
    }

    return (): void => {
      for (const subscriptionId of subscriptionIds) {
        params.pool.unsubscribe(subscriptionId);
      }
    };
  }, [enabled, ingestTargets, params.myPublicKeyHex, params.pool, profileId]);
};

export const useWorkspaceKernelJoinedGroupsRelayIngestRefresh = (
  onRefresh: () => void,
): void => {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const refresh = (): void => {
      onRefresh();
    };
    window.addEventListener(COORDINATION_MEMBERSHIP_DIRECTORY_CHANGED_EVENT, refresh);
    window.addEventListener(COMMUNITY_MEMBERSHIP_LEDGER_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener(COORDINATION_MEMBERSHIP_DIRECTORY_CHANGED_EVENT, refresh);
      window.removeEventListener(COMMUNITY_MEMBERSHIP_LEDGER_UPDATED_EVENT, refresh);
    };
  }, [onRefresh]);
};
