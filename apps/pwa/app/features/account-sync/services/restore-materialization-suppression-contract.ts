/**
 * R1 — Restore apply contract: local ∪ backup tombstones before chatState materialization.
 * Prevents relay backup from re-introducing delete-for-me rows at apply time.
 */

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { normalizeMessageDeleteTombstoneEntries } from "@dweb/storage-contracts/message-delete-tombstones";
import type { EncryptedAccountBackupPayload } from "../account-sync-contracts";
import { accountProjectionRuntime } from "./account-projection-runtime";
import {
  mergeMessageDeleteTombstones,
  sanitizePersistedChatStateMessagesByDeleteContract,
  toMessageDeleteTombstoneIdSet,
} from "./restore-merge-chat-state";
import { messagingClientOperations } from "@/app/features/messaging/services/messaging-client-operations";
import { buildDmThreadSuppressionIdSet } from "@/app/features/messaging/services/dm-thread-suppression-set";
import { logAppEvent } from "@/app/shared/log-app-event";

export type ResolveRestoreMaterializationSuppressionResult = Readonly<{
  mergedTombstoneEntries: ReadonlyArray<Readonly<{ id: string; deletedAtUnixMs: number }>>;
  durableDeleteIds: ReadonlySet<string>;
  materializedPayload: EncryptedAccountBackupPayload;
}>;

const countPersistedDmMessages = (
  chatState: EncryptedAccountBackupPayload["chatState"],
): number => {
  if (!chatState?.messagesByConversationId) {
    return 0;
  }
  return Object.values(chatState.messagesByConversationId).reduce(
    (sum, messages) => sum + (messages?.length ?? 0),
    0,
  );
};

/**
 * Hydrates local tombstones, merges with backup payload tombstones and projection removals,
 * sanitizes `chatState`, and returns a payload safe to write into stores.
 */
export const resolveRestoreMaterializationSuppressionContract = async (
  params: Readonly<{
    publicKeyHex: PublicKeyHex;
    profileId: string;
    mergedPayload: EncryptedAccountBackupPayload;
  }>,
): Promise<ResolveRestoreMaterializationSuppressionResult> => {
  const nowMs = Date.now();
  const projectionSnapshot = accountProjectionRuntime.getSnapshot();
  const projectionForScope = (
    projectionSnapshot.profileId === params.profileId
    && projectionSnapshot.projection?.accountPublicKeyHex === params.publicKeyHex
  )
    ? projectionSnapshot.projection
    : null;

  await messagingClientOperations.prepareDmThreadSuppressionIds({
    profileId: params.profileId,
    accountPublicKeyHex: params.publicKeyHex,
    projection: projectionForScope,
    messageDeleteTombstones: messagingClientOperations.messageDeleteTombstonesPort(),
    seedIds: new Set<string>(),
  });

  const localTombstoneEntries = normalizeMessageDeleteTombstoneEntries(
    messagingClientOperations.loadDmTombstoneEntries(nowMs, params.profileId),
  );
  const incomingTombstoneEntries = normalizeMessageDeleteTombstoneEntries(
    params.mergedPayload.messageDeleteTombstones ?? [],
  );
  const mergedTombstoneEntries = mergeMessageDeleteTombstones(
    localTombstoneEntries,
    incomingTombstoneEntries,
  );
  const durableDeleteIds = buildDmThreadSuppressionIdSet({
    durableSuppressedIds: toMessageDeleteTombstoneIdSet(mergedTombstoneEntries),
    projection: projectionForScope,
  });

  const dmCountBefore = countPersistedDmMessages(params.mergedPayload.chatState);
  const sanitizedChatState = sanitizePersistedChatStateMessagesByDeleteContract(
    params.mergedPayload.chatState,
    { durableDeleteIds },
  );
  const dmCountAfter = countPersistedDmMessages(sanitizedChatState);

  if (dmCountBefore > dmCountAfter) {
    logAppEvent({
      name: "account_sync.backup_restore_chat_state_sanitized_by_suppression",
      level: "info",
      scope: { feature: "account_sync", action: "backup_restore" },
      context: {
        publicKeySuffix: params.publicKeyHex.slice(-8),
        profileId: params.profileId,
        dmMessageCountBefore: dmCountBefore,
        dmMessageCountAfter: dmCountAfter,
        suppressedIdCount: durableDeleteIds.size,
        localTombstoneCount: localTombstoneEntries.length,
        incomingTombstoneCount: incomingTombstoneEntries.length,
        mergedTombstoneCount: mergedTombstoneEntries.length,
      },
    });
  }

  const materializedPayload: EncryptedAccountBackupPayload = {
    ...params.mergedPayload,
    ...(mergedTombstoneEntries.length > 0 ? { messageDeleteTombstones: mergedTombstoneEntries } : {}),
    chatState: sanitizedChatState,
  };

  return {
    mergedTombstoneEntries,
    durableDeleteIds,
    materializedPayload,
  };
};
