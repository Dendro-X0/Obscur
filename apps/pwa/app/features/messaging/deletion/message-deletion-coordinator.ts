/**
 * Message Deletion Coordinator
 *
 * Canonical owner for delete-for-everyone and remote delete-command ingestion.
 *
 * Delete-for-me (local visibility) is owned by `localDmVisibility.executeDeleteForMe`
 * (R1). `deleteMessageForMe` below is a deprecated adapter for legacy/tests only.
 */

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type {
  DeleteForMeIntent,
  DeleteForEveryoneIntent,
  RemoteDeleteCommand,
  LocalMessageTombstone,
  NetworkMessageTombstone,
  MessageDeletedEvent,
  MessageDeletionFailedEvent,
  MessageIdentity,
  DmDeleteCommandV1,
} from "./types";
import { logAppEvent } from "@/app/shared/log-app-event";
import {
  upsertMessageTombstone,
  findTombstoneByCommandEventId,
  generateTombstoneId,
} from "./message-tombstone-store";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { getResolvedClientGateway } from "@/app/features/profiles/services/resolve-client-gateway";
import { executeDmDeleteForMe } from "@/app/features/messaging/services/dm-local-delete-persistence";
import { dmConversationIdsMatch } from "@/app/features/messaging/utils/dm-conversation-id";

// ---------------------------------------------------------------------------
// Permission Matrix
// ---------------------------------------------------------------------------

/**
 * Delete for Me: Always allowed for any message in any context.
 * This is purely local state.
 */
export function canDeleteForMe(): { allowed: true } {
  return { allowed: true };
}

/**
 * Delete for Everyone: Only allowed if the current user authored the target message.
 */
export function canDeleteForEveryone(
  targetMessage: MessageIdentity,
  myPublicKeyHex: PublicKeyHex
): { allowed: true } | { allowed: false; reason: string } {
  if (targetMessage.senderPubkey !== myPublicKeyHex) {
    return {
      allowed: false,
      reason: "delete_for_everyone_only_allowed_for_own_messages",
    };
  }

  return { allowed: true };
}

// ---------------------------------------------------------------------------
// Event Bus (Integration Point)
// ---------------------------------------------------------------------------

interface DeletionEventBus {
  emit(event: MessageDeletedEvent): void;
  emitFailure(event: MessageDeletionFailedEvent): void;
}

let eventBus: DeletionEventBus | null = null;

const syncDurableDeleteSuppression = (
  profileId: string,
  targetMessageIdentityIds: ReadonlyArray<string>,
  deletedAtUnixMs: number,
): void => {
  targetMessageIdentityIds.forEach((identityId) => {
    getResolvedClientGateway().messageDeleteTombstones.suppressMessageDeleteTombstone(identityId, deletedAtUnixMs, profileId);
  });
};

/**
 * Register the event bus for deletion notifications.
 * Called once during app initialization.
 */
export function registerDeletionEventBus(bus: DeletionEventBus): void {
  eventBus = bus;
}

function emitDeletion(event: MessageDeletedEvent): void {
  eventBus?.emit(event);
}

function emitDeletionFailure(event: MessageDeletionFailedEvent): void {
  eventBus?.emitFailure(event);
}

export async function commitNetworkDeleteTombstone(tombstone: NetworkMessageTombstone): Promise<void> {
  await upsertMessageTombstone(tombstone);
  syncDurableDeleteSuppression(tombstone.profileId, tombstone.targetMessageIdentityIds, tombstone.deletedAt);
  emitDeletion({
    tombstone,
    conversationId: tombstone.conversationId,
    targetMessageIdentityIds: tombstone.targetMessageIdentityIds,
  });
}

// ---------------------------------------------------------------------------
// Delete for Me (Local Only)
// ---------------------------------------------------------------------------

/**
 * @deprecated Use `getResolvedClientGateway().localDmVisibility.executeDeleteForMe` (R1).
 * Adapter for legacy callers/tests — delegates durable suppression to local DM visibility.
 */
export async function deleteMessageForMe(
  intent: DeleteForMeIntent
): Promise<{ success: true; tombstone: LocalMessageTombstone } | { success: false; error: string; code: string }> {
  const permission = canDeleteForMe();
  if (!permission.allowed) {
    return { success: false, error: "unexpected_permission_denial", code: "unexpected_error" };
  }

  try {
    const deletedAt = Date.now();
    const persistedIds = await executeDmDeleteForMe({
      conversationId: intent.conversationId,
      messageIdentityIds: intent.targetMessage.identityIds,
      accountPublicKeyHex: intent.accountPublicKeyHex,
      profileId: intent.profileId,
      observedAtUnixMs: deletedAt,
    });

    if (persistedIds.length === 0) {
      return { success: false, error: "no_message_ids_persisted", code: "storage_error" };
    }

    const tombstone: LocalMessageTombstone = {
      tombstoneId: generateTombstoneId(),
      scope: "local",
      profileId: intent.profileId,
      conversationId: intent.conversationId,
      targetMessageIdentityIds: [...persistedIds],
      targetAuthorPubkey: intent.targetMessage.senderPubkey,
      deletedByPubkey: intent.accountPublicKeyHex,
      deletedAt,
      reason: "delete_for_me",
    };

    emitDeletion({
      tombstone,
      conversationId: intent.conversationId,
      targetMessageIdentityIds: [...persistedIds],
    });

    return { success: true, tombstone };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    emitDeletionFailure({
      intent,
      error,
      code: "storage_error",
    });
    return { success: false, error, code: "storage_error" };
  }
}

// ---------------------------------------------------------------------------
// Delete for Everyone (Network Publish)
// ---------------------------------------------------------------------------

/**
 * Delete a message for all participants.
 *
 * - Verifies the user authored the target message
 * - Creates a network tombstone
 * - Returns command data for network publish
 * - Caller is responsible for actual network publish
 */
export async function deleteMessageForEveryone(
  intent: DeleteForEveryoneIntent,
  options?: Readonly<{ deferLocalTombstone?: boolean }>,
): Promise<
  | { success: true; tombstone: NetworkMessageTombstone; commandPayload: string }
  | { success: false; error: string; code: string }
> {
  // Permission check
  const permission = canDeleteForEveryone(intent.targetMessage, intent.myPublicKeyHex);
  if (!permission.allowed) {
    emitDeletionFailure({
      intent,
      error: permission.reason,
      code: "permission_denied",
    });
    return { success: false, error: permission.reason, code: "permission_denied" };
  }

  try {
    // Import codec here to avoid circular dependency
    const { encodeDmDeleteCommandV1 } = await import("./delete-command-codec");

    const commandPayload = encodeDmDeleteCommandV1({
      conversationId: intent.conversationId,
      targetMessageIdentityIds: intent.targetMessage.identityIds,
      targetAuthorPubkey: intent.targetMessage.senderPubkey,
      deletedByPubkey: intent.myPublicKeyHex,
    });

    // Note: We don't have the commandEventId yet - it will be added after publish
    const tombstone: NetworkMessageTombstone = {
      tombstoneId: generateTombstoneId(),
      scope: "network",
      profileId: intent.profileId,
      conversationId: intent.conversationId,
      targetMessageIdentityIds: intent.targetMessage.identityIds,
      targetAuthorPubkey: intent.targetMessage.senderPubkey,
      deletedByPubkey: intent.myPublicKeyHex,
      deletedAt: Date.now(),
      reason: "delete_for_everyone",
      commandEventId: "pending", // Will be updated after publish
      relayEvidence: [],
    };

    if (!options?.deferLocalTombstone) {
      await upsertMessageTombstone(tombstone);
      syncDurableDeleteSuppression(tombstone.profileId, tombstone.targetMessageIdentityIds, tombstone.deletedAt);

      const event: MessageDeletedEvent = {
        tombstone,
        conversationId: intent.conversationId,
        targetMessageIdentityIds: intent.targetMessage.identityIds,
      };
      emitDeletion(event);
    }

    return { success: true, tombstone, commandPayload };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    emitDeletionFailure({
      intent,
      error,
      code: "storage_error",
    });
    return { success: false, error, code: "storage_error" };
  }
}

/**
 * Update a network tombstone with publish evidence.
 * Call this after the delete command is successfully published.
 */
export async function updateNetworkTombstoneEvidence(
  tombstoneId: string,
  profileId: string,
  commandEventId: string,
  relayUrl?: string
): Promise<void> {
  const { loadMessageTombstones, saveMessageTombstones } = await import(
    "./message-tombstone-store"
  );

  const tombstones = await loadMessageTombstones(profileId);
  const tombstone = tombstones.find((t) => t.tombstoneId === tombstoneId);

  if (!tombstone || tombstone.scope !== "network") {
    console.warn("[deletion-coordinator] tombstone not found for evidence update", {
      tombstoneId,
      profileId,
    });
    return;
  }

  // Update with actual command event ID
  tombstone.commandEventId = commandEventId;

  if (relayUrl && !tombstone.relayEvidence?.includes(relayUrl)) {
    tombstone.relayEvidence = [...(tombstone.relayEvidence || []), relayUrl];
  }

  await saveMessageTombstones(profileId, tombstones);
}

// ---------------------------------------------------------------------------
// Remote Delete Command Ingestion
// ---------------------------------------------------------------------------

/**
 * Ingest a remote delete command from the network.
 *
 * - Verifies the command is valid
 * - Verifies the sender authored the target message
 * - Creates a network tombstone
 * - Emits deletion event
 */
export async function ingestRemoteDeleteCommand(
  remoteCommand: RemoteDeleteCommand,
  myProfileId: string,
  myPublicKeyHex: PublicKeyHex
): Promise<
  | { success: true; tombstone: NetworkMessageTombstone }
  | { success: false; reason: string; code: string }
> {
  const { command, commandEventId, relayUrl } = remoteCommand;

  // Check for duplicate
  const existing = await findTombstoneByCommandEventId(myProfileId, commandEventId);
  if (existing) {
    logAppEvent({
      name: "messaging.delete_for_everyone_remote_result",
      level: "info",
      scope: { feature: "messaging", action: "delete_for_everyone" },
      context: {
        channel: "coordinator_ingest",
        resultCode: "duplicate_ok",
        reasonCode: "duplicate_command",
        deliveryStatus: "received",
        conversationIdHint: command.conversationId.slice(0, 32),
        messageIdHint: command.targetMessageIdentityIds[0]?.slice(0, 16) ?? null,
        conversationKind: "dm",
        isOutgoing: command.deletedByPubkey === myPublicKeyHex,
        deleteTargetCount: command.targetMessageIdentityIds.length,
        remoteMessageIdHint: commandEventId.slice(0, 16),
      },
    });
    return { success: true, tombstone: existing };
  }

  // Verify the sender actually authored the target message
  // This is critical: only the original author can delete for everyone
  if (command.deletedByPubkey !== command.targetAuthorPubkey) {
    logAppEvent({
      name: "messaging.delete_for_everyone_remote_result",
      level: "warn",
      scope: { feature: "messaging", action: "delete_for_everyone" },
      context: {
        channel: "coordinator_permission",
        resultCode: "rejected",
        reasonCode: "sender_not_target_author",
        deliveryStatus: "received",
        conversationIdHint: command.conversationId.slice(0, 32),
        messageIdHint: command.targetMessageIdentityIds[0]?.slice(0, 16) ?? null,
        conversationKind: "dm",
        isOutgoing: command.deletedByPubkey === myPublicKeyHex,
        deleteTargetCount: command.targetMessageIdentityIds.length,
        remoteMessageIdHint: commandEventId.slice(0, 16),
      },
    });
    return {
      success: false,
      reason: "sender_not_target_author",
      code: "permission_denied",
    };
  }

  // Verify the sender signature matches the claimed pubkey
  // Note: This assumes the event was already verified by the caller
  // (decrypted DM or validated community event)
  // We just check internal consistency here
  if (command.deletedByPubkey !== command.targetAuthorPubkey) {
    return {
      success: false,
      reason: "command_sender_mismatch",
      code: "permission_denied",
    };
  }

  try {
    const tombstone: NetworkMessageTombstone = {
      tombstoneId: generateTombstoneId(),
      scope: "network",
      profileId: myProfileId,
      conversationId: command.conversationId,
      targetMessageIdentityIds: command.targetMessageIdentityIds,
      targetAuthorPubkey: command.targetAuthorPubkey,
      deletedByPubkey: command.deletedByPubkey,
      deletedAt: command.deletedAt,
      reason: "delete_for_everyone",
      commandEventId,
      relayEvidence: relayUrl ? [relayUrl] : [],
    };

    await upsertMessageTombstone(tombstone);
    syncDurableDeleteSuppression(tombstone.profileId, tombstone.targetMessageIdentityIds, tombstone.deletedAt);
    console.log("[deletion-coordinator] remote delete tombstone stored", {
      tombstoneId: tombstone.tombstoneId.slice(0, 16),
      profileId: myProfileId,
      conversationId: command.conversationId.slice(0, 32),
      targetMessageIdentityIds: command.targetMessageIdentityIds.map(id => id.slice(0, 16)),
      commandEventId: commandEventId.slice(0, 16),
      relayUrl: relayUrl?.slice(0, 40) ?? null,
    });
    logAppEvent({
      name: "messaging.delete_for_everyone_remote_result",
      level: "info",
      scope: { feature: "messaging", action: "delete_for_everyone" },
      context: {
        channel: "coordinator_store",
        resultCode: "stored",
        reasonCode: null,
        deliveryStatus: "ingested",
        conversationIdHint: command.conversationId.slice(0, 32),
        messageIdHint: command.targetMessageIdentityIds[0]?.slice(0, 16) ?? null,
        conversationKind: "dm",
        isOutgoing: command.deletedByPubkey === myPublicKeyHex,
        deleteTargetCount: command.targetMessageIdentityIds.length,
        remoteMessageIdHint: commandEventId.slice(0, 16),
      },
    });

    const event: MessageDeletedEvent = {
      tombstone,
      conversationId: command.conversationId,
      targetMessageIdentityIds: command.targetMessageIdentityIds,
    };
    emitDeletion(event);

    // Local destructive purge + projection DM_REMOVED is owned by applyDmThreadRedaction
    // (receiver) or the sender delete path. Ingest here only records network tombstone evidence.

    return { success: true, tombstone };
  } catch (err) {
    console.error("[deletion-coordinator] failed to ingest remote delete", err);
    logAppEvent({
      name: "messaging.delete_for_everyone_remote_result",
      level: "error",
      scope: { feature: "messaging", action: "delete_for_everyone" },
      context: {
        channel: "coordinator_store",
        resultCode: "failed",
        reasonCode: "storage_error",
        deliveryStatus: "received",
        conversationIdHint: command.conversationId.slice(0, 32),
        messageIdHint: command.targetMessageIdentityIds[0]?.slice(0, 16) ?? null,
        conversationKind: "dm",
        isOutgoing: command.deletedByPubkey === myPublicKeyHex,
        deleteTargetCount: command.targetMessageIdentityIds.length,
        remoteMessageIdHint: commandEventId.slice(0, 16),
      },
    });
    return {
      success: false,
      reason: "storage_error",
      code: "storage_error",
    };
  }
}

// ---------------------------------------------------------------------------
// DM-Specific Ingestion
// ---------------------------------------------------------------------------

/**
 * Process an incoming DM delete command.
 * Called by the DM receive pipeline when a delete command is detected.
 */
export async function processIncomingDmDeleteCommand(
  plaintext: string,
  senderPubkey: PublicKeyHex,
  conversationId: string,
  commandEventId: string,
  relayUrl: string | undefined,
  myPublicKeyHex: PublicKeyHex
): Promise<
  | { success: true; tombstone: NetworkMessageTombstone }
  | { success: false; reason: string; code: string }
> {
  const { decodeDmDeleteCommandLenient } = await import("./delete-command-codec");
  const command = decodeDmDeleteCommandLenient(plaintext);

  if (!command) {
    logAppEvent({
      name: "messaging.delete_for_everyone_remote_result",
      level: "warn",
      scope: { feature: "messaging", action: "delete_for_everyone" },
      context: {
        channel: "coordinator_decode",
        resultCode: "invalid",
        reasonCode: "invalid_command",
        deliveryStatus: "received",
        conversationIdHint: conversationId.slice(0, 32),
        messageIdHint: null,
        conversationKind: "dm",
        isOutgoing: senderPubkey === myPublicKeyHex,
        deleteTargetCount: 0,
        remoteMessageIdHint: commandEventId.slice(0, 16),
      },
    });
    return { success: false, reason: "invalid_command", code: "invalid_command" };
  }

  if (command.deletedByPubkey !== senderPubkey) {
    logAppEvent({
      name: "messaging.delete_for_everyone_remote_result",
      level: "warn",
      scope: { feature: "messaging", action: "delete_for_everyone" },
      context: {
        channel: "coordinator_decode",
        resultCode: "rejected",
        reasonCode: "sender_mismatch",
        deliveryStatus: "received",
        conversationIdHint: command.conversationId.slice(0, 32),
        messageIdHint: command.targetMessageIdentityIds[0]?.slice(0, 16) ?? null,
        conversationKind: "dm",
        isOutgoing: senderPubkey === myPublicKeyHex,
        deleteTargetCount: command.targetMessageIdentityIds.length,
        remoteMessageIdHint: commandEventId.slice(0, 16),
      },
    });
    return { success: false, reason: "sender_mismatch", code: "permission_denied" };
  }
  const { toDmConversationId, resolveDmCounterpartyPubkey } = await import("../utils/dm-conversation-id");
  const peerPubkey = resolveDmCounterpartyPubkey({
    myPublicKeyHex,
    senderPubkey,
  });
  const expectedConversationId = toDmConversationId({
    myPublicKeyHex,
    peerPublicKeyHex: peerPubkey,
  });
  const conversationMatches = (
    command.conversationId === conversationId
    || (expectedConversationId != null && (
      command.conversationId === expectedConversationId
      || conversationId === expectedConversationId
    ))
    || dmConversationIdsMatch(command.conversationId, conversationId, myPublicKeyHex, senderPubkey)
  );
  if (!conversationMatches) {
    logAppEvent({
      name: "messaging.delete_for_everyone_remote_result",
      level: "warn",
      scope: { feature: "messaging", action: "delete_for_everyone" },
      context: {
        channel: "coordinator_decode",
        resultCode: "rejected",
        reasonCode: "conversation_mismatch",
        deliveryStatus: "received",
        conversationIdHint: conversationId.slice(0, 32),
        messageIdHint: command.targetMessageIdentityIds[0]?.slice(0, 16) ?? null,
        conversationKind: "dm",
        isOutgoing: senderPubkey === myPublicKeyHex,
        deleteTargetCount: command.targetMessageIdentityIds.length,
        remoteMessageIdHint: commandEventId.slice(0, 16),
      },
    });
    return { success: false, reason: "conversation_mismatch", code: "invalid_command" };
  }

  const profileId = getResolvedProfileId();
  if (!profileId) {
    logAppEvent({
      name: "messaging.delete_for_everyone_remote_result",
      level: "warn",
      scope: { feature: "messaging", action: "delete_for_everyone" },
      context: {
        channel: "coordinator_scope",
        resultCode: "rejected",
        reasonCode: "no_active_profile",
        deliveryStatus: "received",
        conversationIdHint: conversationId.slice(0, 32),
        messageIdHint: command.targetMessageIdentityIds[0]?.slice(0, 16) ?? null,
        conversationKind: "dm",
        isOutgoing: senderPubkey === myPublicKeyHex,
        deleteTargetCount: command.targetMessageIdentityIds.length,
        remoteMessageIdHint: commandEventId.slice(0, 16),
      },
    });
    return { success: false, reason: "no_active_profile", code: "invalid_context" };
  }

  console.log("[deletion-coordinator] incoming delete command decoded", {
    commandEventId: commandEventId.slice(0, 16),
    senderPubkey: senderPubkey.slice(0, 16),
    myPublicKeyHex: myPublicKeyHex.slice(0, 16),
    profileId,
    conversationId: conversationId.slice(0, 32),
    targetMessageIdentityIds: command.targetMessageIdentityIds.map(id => id.slice(0, 16)),
    targetAuthorPubkey: command.targetAuthorPubkey.slice(0, 16),
    deletedByPubkey: command.deletedByPubkey.slice(0, 16),
  });
  logAppEvent({
    name: "messaging.delete_for_everyone_remote_result",
    level: "info",
    scope: { feature: "messaging", action: "delete_for_everyone" },
    context: {
      channel: "coordinator_decode",
      resultCode: "valid",
      reasonCode: null,
      deliveryStatus: "received",
      conversationIdHint: conversationId.slice(0, 32),
      messageIdHint: command.targetMessageIdentityIds[0]?.slice(0, 16) ?? null,
      conversationKind: "dm",
      isOutgoing: senderPubkey === myPublicKeyHex,
      deleteTargetCount: command.targetMessageIdentityIds.length,
      remoteMessageIdHint: commandEventId.slice(0, 16),
    },
  });

  return ingestRemoteDeleteCommand(
    {
      command,
      commandEventId,
      relayUrl,
      decryptedPayload: plaintext,
    },
    profileId,
    myPublicKeyHex
  );
}

/**
 * Ingest after receive pipeline already resolved target ids (avoids strict re-decode mismatch).
 */
export async function ingestDmDeleteFromResolvedTargets(params: Readonly<{
  conversationId: string;
  targetMessageIdentityIds: ReadonlyArray<string>;
  senderPubkey: PublicKeyHex;
  commandEventId: string;
  relayUrl?: string;
  myPublicKeyHex: PublicKeyHex;
  deletedAtUnixMs?: number;
  decryptedPayload?: string;
}>): Promise<
  | { success: true; tombstone: NetworkMessageTombstone }
  | { success: false; reason: string; code: string }
> {
  const profileId = getResolvedProfileId();
  if (!profileId) {
    return { success: false, reason: "no_active_profile", code: "invalid_context" };
  }

  const targetMessageIdentityIds = params.targetMessageIdentityIds
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
  if (targetMessageIdentityIds.length === 0) {
    return { success: false, reason: "no_targets", code: "invalid_command" };
  }

  const command: DmDeleteCommandV1 = {
    type: "message_delete_v1",
    mode: "delete_for_everyone",
    conversationId: params.conversationId,
    targetMessageIdentityIds,
    targetAuthorPubkey: params.senderPubkey,
    deletedByPubkey: params.senderPubkey,
    deletedAt: params.deletedAtUnixMs ?? Date.now(),
    nonce: params.commandEventId,
  };

  return ingestRemoteDeleteCommand(
    {
      command,
      commandEventId: params.commandEventId,
      relayUrl: params.relayUrl,
      decryptedPayload: params.decryptedPayload ?? "",
    },
    profileId,
    params.myPublicKeyHex,
  );
}

// ---------------------------------------------------------------------------
// Community-Specific Ingestion
// ---------------------------------------------------------------------------

/**
 * Process an incoming community delete command.
 * Called by the community/group receive pipeline.
 */
export async function processIncomingCommunityDeleteCommand(
  plaintext: string,
  senderPubkey: PublicKeyHex,
  groupId: string,
  relayUrl: string,
  commandEventId: string
): Promise<
  | { success: true; tombstone: NetworkMessageTombstone }
  | { success: false; reason: string; code: string }
> {
  const { decodeCommunityDeleteCommandV1 } = await import("./delete-command-codec");
  const command = decodeCommunityDeleteCommandV1(plaintext);

  if (!command) {
    return { success: false, reason: "invalid_command", code: "invalid_command" };
  }

  // Verify sender matches command
  if (command.deletedByPubkey !== senderPubkey) {
    return { success: false, reason: "sender_mismatch", code: "permission_denied" };
  }

  // Verify community context
  if (command.groupId !== groupId || command.relayUrl !== relayUrl) {
    return { success: false, reason: "community_mismatch", code: "invalid_command" };
  }

  // Get current profile
  const profileId = getResolvedProfileId();
  if (!profileId) {
    return { success: false, reason: "no_active_profile", code: "invalid_context" };
  }

  return ingestRemoteDeleteCommand(
    {
      command,
      commandEventId,
      relayUrl,
      decryptedPayload: plaintext,
    },
    profileId,
    senderPubkey
  );
}
