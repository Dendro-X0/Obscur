/**
 * Community membership sync — v1.9.2 B2
 *
 * Nostr relay hints remain secondary. When coordination is configured,
 * `coordination_preferred` polls the membership directory and applies semantic
 * events through the membership kernel port.
 */

import type { NostrEvent } from "@dweb/nostr/nostr-event";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { SemanticCommunityMemberEvent } from "@dweb/transport-contracts";
import { logAppEvent } from "@/app/shared/log-app-event";
import {
  fetchCoordinationMembershipDeltasSince,
  mapCoordinationRecordToSemantic,
} from "./community-coordination-membership-client";
import { applyCoordinationMembershipDeltasToDirectoryStore } from "./community-coordination-membership-directory-store";
import {
  loadCoordinationMembershipSeqCursor,
  saveCoordinationMembershipSeqCursor,
} from "./community-coordination-membership-cursor";
import {
  isCoordinationConfigured,
  readMembershipSyncMode,
  type MembershipSyncMode,
} from "./community-membership-sync-mode";
import { isBrowserOffline } from "@/app/features/runtime/offline-runtime-policy";

export type { MembershipSyncMode };

export interface MembershipSyncOptions {
  groupId: string;
  relayUrl: string;
  communityId?: string;
  profileId?: string;
  pollIntervalMs?: number;
  /** When false, no background coordination polling (default true). */
  pollEnabled?: boolean;
  /** Pause polling while the document is hidden (default true). */
  pauseWhenDocumentHidden?: boolean;
  onSemanticMemberEvent?: (event: SemanticCommunityMemberEvent) => void;
  /** @deprecated Use onSemanticMemberEvent — Nostr wire callback */
  onMemberJoined?: (memberPubkey: PublicKeyHex, event: NostrEvent) => void;
  /** @deprecated Use onSemanticMemberEvent */
  onMemberLeft?: (memberPubkey: PublicKeyHex, event: NostrEvent) => void;
}

export interface MembershipSyncState {
  memberPubkeys: ReadonlyArray<PublicKeyHex>;
  lastSyncAt: number | null;
  isSubscribed: boolean;
  lastSeq: number;
  mode: MembershipSyncMode;
}

const DEFAULT_POLL_MS = 30_000;
const MAX_POLL_BACKOFF_MS = 120_000;

const resolveCommunityId = (options: MembershipSyncOptions): string => (
  (options.communityId ?? options.groupId).trim()
);

export const resolveCoordinationPollBackoffMs = (
  basePollMs: number,
  consecutiveFailures: number,
): number => {
  if (consecutiveFailures <= 0) {
    return basePollMs;
  }
  const exponent = Math.min(consecutiveFailures, 5);
  return Math.min(MAX_POLL_BACKOFF_MS, basePollMs * (2 ** exponent));
};

/**
 * Subscribe to coordination membership directory (B2 canonical path).
 */
export type MembershipSyncHandle = Readonly<{
  unsubscribe: () => void;
  getState: () => MembershipSyncState;
  /** Forces an immediate coordination delta pull (used by manual reconcile). */
  forceSyncNow: () => Promise<void>;
}>;

export function subscribeToMembershipEvents(
  options: MembershipSyncOptions,
): MembershipSyncHandle {
  const mode = readMembershipSyncMode();
  const communityId = resolveCommunityId(options);
  const basePollMs = options.pollIntervalMs ?? DEFAULT_POLL_MS;
  const pollEnabled = options.pollEnabled !== false;
  const pauseWhenDocumentHidden = options.pauseWhenDocumentHidden !== false;
  let cancelled = false;
  let lastSeq = loadCoordinationMembershipSeqCursor(communityId, options.profileId);
  let lastSyncAt: number | null = null;
  let pollTimer: ReturnType<typeof setTimeout> | null = null;
  let consecutiveFailures = 0;
  let documentVisible = typeof document === "undefined" || document.visibilityState === "visible";

  const getState = (): MembershipSyncState => ({
    memberPubkeys: [],
    lastSyncAt,
    isSubscribed: !cancelled && mode === "coordination_preferred" && isCoordinationConfigured(),
    lastSeq,
    mode,
  });

  const clearPollTimer = (): void => {
    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
  };

  const shouldPollNow = (): boolean => (
    !cancelled
    && pollEnabled
    && mode === "coordination_preferred"
    && isCoordinationConfigured()
    && !isBrowserOffline()
    && (!pauseWhenDocumentHidden || documentVisible)
  );

  const schedulePoll = (delayMs: number): void => {
    if (!shouldPollNow()) {
      return;
    }
    clearPollTimer();
    pollTimer = setTimeout(() => {
      void applyDeltas();
    }, delayMs);
  };

  const onVisibilityChange = (): void => {
    if (typeof document === "undefined") {
      return;
    }
    documentVisible = document.visibilityState === "visible";
    if (!documentVisible) {
      clearPollTimer();
      return;
    }
    if (shouldPollNow()) {
      void applyDeltas();
    }
  };

  const applySemanticFromDelta = (semantic: SemanticCommunityMemberEvent): void => {
    options.onSemanticMemberEvent?.(semantic);
    if (semantic.type === "COMMUNITY_MEMBER_JOINED" && options.onMemberJoined) {
      options.onMemberJoined(semantic.subjectPublicKeyHex as PublicKeyHex, {
        id: semantic.logicalEventId,
        pubkey: semantic.actorPublicKeyHex,
        created_at: Math.floor(semantic.createdAtUnixMs / 1000),
        kind: 0,
        tags: [],
        content: "",
        sig: "",
      } as NostrEvent);
    }
    if (semantic.type === "COMMUNITY_MEMBER_LEFT" && options.onMemberLeft) {
      options.onMemberLeft(semantic.subjectPublicKeyHex as PublicKeyHex, {
        id: semantic.logicalEventId,
        pubkey: semantic.actorPublicKeyHex,
        created_at: Math.floor(semantic.createdAtUnixMs / 1000),
        kind: 0,
        tags: [],
        content: "",
        sig: "",
      } as NostrEvent);
    }
  };

  const logPollFailure = (
    context: Readonly<Record<string, string | number | boolean | null>>,
  ): void => {
    if (consecutiveFailures !== 1 && consecutiveFailures % 5 !== 0) {
      return;
    }
    logAppEvent({
      name: "groups.coordination_membership_poll_failed",
      level: "warn",
      scope: { feature: "groups", action: "coordination_membership_poll" },
      context,
    });
  };

  const applyDeltas = async (): Promise<void> => {
    if (!shouldPollNow()) {
      return;
    }
    try {
      const result = await fetchCoordinationMembershipDeltasSince(communityId, lastSeq);
      if (!result.ok) {
        consecutiveFailures += 1;
        logPollFailure({
          communityId: communityId.slice(0, 24),
          error: result.error,
          status: result.status,
          consecutiveFailures,
        });
        schedulePoll(resolveCoordinationPollBackoffMs(basePollMs, consecutiveFailures));
        return;
      }

      consecutiveFailures = 0;
      if (result.deltas.length === 0) {
        schedulePoll(basePollMs);
        return;
      }

      for (const delta of result.deltas) {
        lastSeq = Math.max(lastSeq, delta.seq);
        const semantic = mapCoordinationRecordToSemantic(delta);
        if (!semantic) {
          continue;
        }
        applySemanticFromDelta(semantic);
      }
      applyCoordinationMembershipDeltasToDirectoryStore({
        communityId,
        deltas: result.deltas,
        profileId: options.profileId,
      });
      saveCoordinationMembershipSeqCursor(communityId, lastSeq, options.profileId);
      lastSyncAt = Date.now();
      schedulePoll(basePollMs);
    } catch (error) {
      consecutiveFailures += 1;
      logPollFailure({
        communityId: communityId.slice(0, 24),
        error: error instanceof Error ? error.message : "poll_failed",
        consecutiveFailures,
      });
      schedulePoll(resolveCoordinationPollBackoffMs(basePollMs, consecutiveFailures));
    }
  };

  if (typeof document !== "undefined" && pauseWhenDocumentHidden) {
    document.addEventListener("visibilitychange", onVisibilityChange);
  }

  if (shouldPollNow()) {
    void applyDeltas();
  }

  return {
    unsubscribe: () => {
      cancelled = true;
      clearPollTimer();
      if (typeof document !== "undefined" && pauseWhenDocumentHidden) {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
    },
    getState,
    forceSyncNow: async () => {
      await applyDeltas();
    },
  };
}

/** @deprecated NIP-29 join hint — directory uses coordination deltas in B2 */
export function processNip29JoinEvent(event: NostrEvent): {
  memberPubkey: PublicKeyHex;
  groupId: string;
  valid: boolean;
} | null {
  if (event.kind !== 39001) return null;
  const groupId = event.tags.find((t) => t[0] === "h")?.[1];
  if (!groupId) return null;
  return { memberPubkey: event.pubkey as PublicKeyHex, groupId, valid: true };
}

/** @deprecated NIP-29 leave hint */
export function processNip29LeaveEvent(event: NostrEvent): {
  memberPubkey: PublicKeyHex;
  groupId: string;
  valid: boolean;
} | null {
  if (event.kind !== 39002) return null;
  const groupId = event.tags.find((t) => t[0] === "h")?.[1];
  if (!groupId) return null;
  return { memberPubkey: event.pubkey as PublicKeyHex, groupId, valid: true };
}

export async function gossipSyncMembership(_params: {
  groupId: string;
  relayUrl: string;
  since?: number;
}): Promise<{ memberPubkeys: ReadonlyArray<PublicKeyHex>; syncedAt: number }> {
  return { memberPubkeys: [], syncedAt: Date.now() };
}

export function resolveMembershipConflict(
  localView: ReadonlyArray<PublicKeyHex>,
  _remoteView: ReadonlyArray<PublicKeyHex>,
  _operations: ReadonlyArray<{ type: "join" | "leave"; pubkey: PublicKeyHex; timestamp: number }>,
): ReadonlyArray<PublicKeyHex> {
  return localView;
}
