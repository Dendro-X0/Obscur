/**
 * Canonical owner: apply DM delete-for-everyone (sender redaction) on this device.
 *
 * One ingress for relay delete commands. Resolves identity ids against every local
 * read model, persists suppression/tombstone, then notifies ChatView via callback
 * (message bus). Does not mutate dm-controller in-memory lists — ChatView does not
 * read that source.
 */

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { NostrEvent } from "@dweb/nostr/nostr-event";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { ingestDmDeleteFromResolvedTargets } from "../deletion/message-deletion-coordinator";
import { toDmConversationIdFromEvent } from "../utils/dm-conversation-id";
import { expandDmDeleteIdsForThread } from "./expand-dm-delete-ids-for-thread";
import { applyDmRedactionDisplayGateAsync } from "./dm-redaction-display-gate";
import { messagingClientOperations } from "./messaging-client-operations";
import { logAppEvent } from "@/app/shared/log-app-event";

const processedCommandEventIds = new Set<string>();
const MAX_PROCESSED_COMMAND_IDS = 4000;

const rememberCommandEvent = (commandEventId: string): boolean => {
  if (processedCommandEventIds.has(commandEventId)) {
    return false;
  }
  processedCommandEventIds.add(commandEventId);
  if (processedCommandEventIds.size > MAX_PROCESSED_COMMAND_IDS) {
    const oldest = processedCommandEventIds.values().next().value;
    if (oldest) {
      processedCommandEventIds.delete(oldest);
    }
  }
  return true;
};

export type ApplyDmThreadRedactionParams = Readonly<{
  nostrEvent: NostrEvent;
  plaintext: string;
  targetMessageIds: ReadonlyArray<string>;
  conversationIdHint?: string;
  relayUrl?: string;
  myPublicKeyHex: PublicKeyHex;
  /** Fires once with fully expanded ids — wire to messageBus.emitMessageDeleted */
  onRedactionApplied: (params: Readonly<{
    conversationId: string;
    messageId: string;
    messageIdentityIds: ReadonlyArray<string>;
    conversationIdOriginal?: string;
  }>) => void;
}>;

export type ApplyDmThreadRedactionResult = Readonly<{
  /** `complete` = tombstone + projection; `duplicate_skipped` = relay redelivery */
  status: "complete" | "tombstone_failed" | "duplicate_skipped" | "no_profile" | "no_targets" | "projection_failed";
  conversationId: string;
  resolvedIdentityIds: ReadonlyArray<string>;
  tombstoneStored: boolean;
  projectionRedacted: boolean;
}>;

export const applyDmThreadRedaction = async (
  params: ApplyDmThreadRedactionParams,
): Promise<ApplyDmThreadRedactionResult> => {
  const profileId = getResolvedProfileId();
  const canonicalConversationId = toDmConversationIdFromEvent({
    myPublicKeyHex: params.myPublicKeyHex,
    senderPubkey: params.nostrEvent.pubkey,
    tags: params.nostrEvent.tags,
  }) ?? [params.myPublicKeyHex, params.nostrEvent.pubkey].sort().join(":");

  if (!profileId) {
    return {
      status: "no_profile",
      conversationId: canonicalConversationId,
      resolvedIdentityIds: [],
      tombstoneStored: false,
      projectionRedacted: false,
    };
  }

  const isFirstDelivery = rememberCommandEvent(params.nostrEvent.id);

  const resolvedIdentityIds = await expandDmDeleteIdsForThread({
    conversationId: canonicalConversationId,
    myPublicKeyHex: params.myPublicKeyHex,
    targetMessageIds: params.targetMessageIds,
    plaintext: params.plaintext,
    deleteAuthorPubkey: params.nostrEvent.pubkey as PublicKeyHex,
  });

  if (resolvedIdentityIds.length === 0) {
    return {
      status: "no_targets",
      conversationId: canonicalConversationId,
      resolvedIdentityIds: [],
      tombstoneStored: false,
      projectionRedacted: false,
    };
  }

  const gatedIds = await applyDmRedactionDisplayGateAsync({
    profileId,
    conversationId: canonicalConversationId,
    identityIds: resolvedIdentityIds,
    myPublicKeyHex: params.myPublicKeyHex,
    deleteAuthorPubkey: params.nostrEvent.pubkey as PublicKeyHex,
  });
  if (gatedIds.length === 0) {
    return {
      status: "no_targets",
      conversationId: canonicalConversationId,
      resolvedIdentityIds: [],
      tombstoneStored: false,
      projectionRedacted: false,
    };
  }

  if (!isFirstDelivery) {
    return {
      status: "duplicate_skipped",
      conversationId: canonicalConversationId,
      resolvedIdentityIds,
      tombstoneStored: false,
      projectionRedacted: false,
    };
  }

  const conversationIdHint = params.conversationIdHint?.trim();
  const conversationIdOriginal = (
    conversationIdHint
    && conversationIdHint.length > 0
    && conversationIdHint !== canonicalConversationId
  )
    ? conversationIdHint
    : undefined;

  let projectionRedacted = false;
  try {
    await messagingClientOperations.deleteDmForMe({
      conversationId: canonicalConversationId,
      messageIdentityIds: resolvedIdentityIds,
      accountPublicKeyHex: params.myPublicKeyHex,
      profileId,
      observedAtUnixMs: params.nostrEvent.created_at * 1000,
      replayProjection: true,
      skipEventLogReconcile: false,
      redactTimelineEvents: true,
    });
    projectionRedacted = true;
  } catch (purgeErr) {
    console.error("[dm-redaction] projection redaction purge failed", purgeErr);
    logAppEvent({
      name: "messaging.delete_for_everyone_remote_result",
      level: "error",
      scope: { feature: "messaging", action: "delete_for_everyone" },
      context: {
        channel: "dm_thread_redaction_projection",
        resultCode: "projection_failed",
        reasonCode: purgeErr instanceof Error ? purgeErr.message : String(purgeErr),
        deliveryStatus: "received",
        conversationIdHint: canonicalConversationId.slice(0, 32),
        messageIdHint: resolvedIdentityIds[0]?.slice(0, 16) ?? null,
        conversationKind: "dm",
        isOutgoing: params.nostrEvent.pubkey === params.myPublicKeyHex,
        deleteTargetCount: resolvedIdentityIds.length,
        remoteMessageIdHint: params.nostrEvent.id.slice(0, 16),
      },
    });
    return {
      status: "projection_failed",
      conversationId: canonicalConversationId,
      resolvedIdentityIds,
      tombstoneStored: false,
      projectionRedacted: false,
    };
  }

  const ingestResult = await ingestDmDeleteFromResolvedTargets({
    conversationId: canonicalConversationId,
    targetMessageIdentityIds: resolvedIdentityIds,
    senderPubkey: params.nostrEvent.pubkey as PublicKeyHex,
    commandEventId: params.nostrEvent.id,
    relayUrl: params.relayUrl,
    myPublicKeyHex: params.myPublicKeyHex,
    deletedAtUnixMs: params.nostrEvent.created_at * 1000,
    decryptedPayload: params.plaintext,
  });

  params.onRedactionApplied({
    conversationId: canonicalConversationId,
    messageId: resolvedIdentityIds[0] ?? "",
    messageIdentityIds: resolvedIdentityIds,
    conversationIdOriginal,
  });

  logAppEvent({
    name: "messaging.delete_for_everyone_remote_result",
    level: ingestResult.success ? "info" : "warn",
    scope: { feature: "messaging", action: "delete_for_everyone" },
    context: {
      channel: "dm_thread_redaction_owner",
      resultCode: ingestResult.success ? "complete" : "projection_only",
      reasonCode: ingestResult.success ? null : ingestResult.code,
      deliveryStatus: "received",
      conversationIdHint: canonicalConversationId.slice(0, 32),
      messageIdHint: resolvedIdentityIds[0]?.slice(0, 16) ?? null,
      conversationKind: "dm",
      isOutgoing: params.nostrEvent.pubkey === params.myPublicKeyHex,
      deleteTargetCount: resolvedIdentityIds.length,
      remoteMessageIdHint: params.nostrEvent.id.slice(0, 16),
    },
  });

  return {
    status: ingestResult.success ? "complete" : "tombstone_failed",
    conversationId: canonicalConversationId,
    resolvedIdentityIds,
    tombstoneStored: ingestResult.success,
    projectionRedacted,
  };
};

/** Test-only reset */
export const resetDmThreadRedactionDedupForTests = (): void => {
  processedCommandEventIds.clear();
};
