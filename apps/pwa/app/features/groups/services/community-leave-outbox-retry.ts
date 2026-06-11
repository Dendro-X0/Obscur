import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import { roomKeyStore } from "@/app/features/crypto/room-key-store";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import {
  getRelaySnapshot,
  publishViaRelayCore,
} from "@/app/features/relays/lib/nostr-core-relay";
import { logAppEvent } from "@/app/shared/log-app-event";
import { toScopedRelayUrl } from "../hooks/use-sealed-community";
import {
  getPendingCommunityLeaveOutboxItems,
  recordCommunityLeaveRelayPublishOutcome,
} from "./community-leave-outbox";
import { GroupService } from "./group-service";

export type FlushCommunityLeaveOutboxResult = Readonly<{
  attempted: number;
  published: number;
  failed: number;
  skippedNoWritableRelay: boolean;
}>;

export type RelayPoolLike = Readonly<{
  publishToUrls?: (urls: ReadonlyArray<string>, payload: string) => Promise<{ success: boolean }>;
  publishToAll: (payload: string) => Promise<{ success: boolean }>;
  waitForConnection?: (timeoutMs: number) => Promise<void>;
}>;

const flushInFlightByScope = new Map<string, Promise<FlushCommunityLeaveOutboxResult>>();

export const publishLeaveEventToRelay = async (params: Readonly<{
  pool: RelayPoolLike;
  relayUrl: string;
  event: unknown;
  waitForConnectionMs?: number;
}>): Promise<Readonly<{ success: boolean; errorMessage?: string }>> => {
  const scopedRelayUrl = toScopedRelayUrl(params.relayUrl);
  const scopedRelayUrls = scopedRelayUrl ? [scopedRelayUrl] : [params.relayUrl];
  const result = await publishViaRelayCore({
    pool: params.pool,
    payload: JSON.stringify(["EVENT", params.event]),
    scopedRelayUrls,
    waitForConnectionMs: params.waitForConnectionMs ?? 1_200,
  });
  if (result.status === "ok" || result.status === "partial") {
    return { success: true };
  }
  return {
    success: false,
    errorMessage: result.message ?? result.reasonCode ?? "publish_failed",
  };
};

const flushPendingCommunityLeaveOutboxInner = async (params: Readonly<{
  publicKeyHex: string;
  privateKeyHex: PrivateKeyHex;
  pool: RelayPoolLike;
  profileId: string;
  nowUnixMs?: number;
  maxItems?: number;
}>): Promise<FlushCommunityLeaveOutboxResult> => {
  const nowUnixMs = params.nowUnixMs ?? Date.now();
  const pending = getPendingCommunityLeaveOutboxItems(
    params.publicKeyHex,
    nowUnixMs,
    params.profileId,
  );
  if (pending.length === 0) {
    return { attempted: 0, published: 0, failed: 0, skippedNoWritableRelay: false };
  }

  let snapshot = getRelaySnapshot(params.pool);
  if (snapshot.writableRelayUrls.length === 0) {
    await params.pool.waitForConnection(1_200);
    snapshot = getRelaySnapshot(params.pool);
  }
  if (snapshot.writableRelayUrls.length === 0) {
    return { attempted: 0, published: 0, failed: 0, skippedNoWritableRelay: true };
  }

  const batch = pending.slice(0, params.maxItems ?? 8);
  const groupService = new GroupService(params.publicKeyHex, params.privateKeyHex);
  let published = 0;
  let failed = 0;

  for (const item of batch) {
    try {
      const nip29Leave = await groupService.sendNip29Leave({ groupId: item.groupId });
      const nip29Result = await publishLeaveEventToRelay({
        pool: params.pool,
        relayUrl: item.relayUrl,
        event: nip29Leave,
      });
      recordCommunityLeaveRelayPublishOutcome({
        publicKeyHex: params.publicKeyHex,
        groupId: item.groupId,
        relayUrl: item.relayUrl,
        success: nip29Result.success,
        errorMessage: nip29Result.errorMessage,
        profileId: params.profileId,
      });
      if (!nip29Result.success) {
        failed += 1;
        continue;
      }
      published += 1;
      try {
        const roomKeyHex = await roomKeyStore.getRoomKey(item.groupId);
        if (roomKeyHex) {
          const sealedLeave = await groupService.sendSealedLeave({
            groupId: item.groupId,
            roomKeyHex,
          });
          await publishLeaveEventToRelay({
            pool: params.pool,
            relayUrl: item.relayUrl,
            event: sealedLeave,
          });
        }
      } catch {
        // Sealed leave is best-effort after durable NIP-29 leave.
      }
    } catch (error) {
      failed += 1;
      recordCommunityLeaveRelayPublishOutcome({
        publicKeyHex: params.publicKeyHex,
        groupId: item.groupId,
        relayUrl: item.relayUrl,
        success: false,
        errorMessage: error instanceof Error ? error.message : "flush_failed",
        profileId: params.profileId,
      });
    }
  }

  logAppEvent({
    name: "groups.leave_outbox_flush_completed",
    level: failed > 0 ? "warn" : "info",
    scope: { feature: "groups", action: "leave_outbox" },
    context: {
      attempted: batch.length,
      published,
      failed,
      pendingBefore: pending.length,
    },
  });

  return {
    attempted: batch.length,
    published,
    failed,
    skippedNoWritableRelay: false,
  };
};

/** Retry pending community leave publishes (ledger already terminal `left`). */
export const flushPendingCommunityLeaveOutbox = async (params: Readonly<{
  publicKeyHex: string;
  privateKeyHex: PrivateKeyHex;
  pool: RelayPoolLike;
  profileId?: string;
  nowUnixMs?: number;
  maxItems?: number;
}>): Promise<FlushCommunityLeaveOutboxResult> => {
  const profileId = params.profileId ?? getResolvedProfileId();
  const scopeKey = `${profileId}::${params.publicKeyHex}`;
  const inFlight = flushInFlightByScope.get(scopeKey);
  if (inFlight) {
    return inFlight;
  }
  const promise = flushPendingCommunityLeaveOutboxInner({
    ...params,
    profileId,
  });
  flushInFlightByScope.set(scopeKey, promise);
  try {
    return await promise;
  } finally {
    flushInFlightByScope.delete(scopeKey);
  }
};
