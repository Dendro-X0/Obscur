/**
 * R1 — Canonical client operations facade for DM visibility and thread materialization.
 *
 * Product code must route mutations through this module (or gateway ports it delegates to).
 * Avoid parallel calls to tombstone stores, chat-state removal, or legacy hydrate helpers.
 */

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { getResolvedClientGateway } from "@/app/features/profiles/services/resolve-client-gateway";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import type {
  ExecuteLocalDmDeleteForMeParams,
  ExecuteLocalDmShowAgainParams,
} from "@/app/features/messaging/local-dm-visibility";
import type { PersistLocalDmSuppressionParams } from "@dweb/client-gateway/local-dm-visibility";
import type { Message } from "../types";
import type { MessageDeleteTombstonesPersistencePort } from "@/app/features/profiles/types/storage-ports";
import type { RunDmConversationHydrateReadModelPipelineParams } from "./dm-conversation-hydrate-pipeline";
import type { PrepareDmThreadSuppressionParams } from "./dm-thread-suppression-prepare";
import type {
  BuildProjectionEvidenceMessagesParams,
  DmConversationMaterializationPort,
} from "./dm-conversation-materialization-port";
import type { LocalDmVisibilityScope, MessageLikeWithIdentity } from "../local-dm-visibility";
import type { MessageDeleteTombstoneEntry } from "@dweb/storage-contracts/message-delete-tombstones";

const gateway = () => getResolvedClientGateway();

const materialization = (): DmConversationMaterializationPort => (
  gateway().dmConversationMaterialization
);

export const messagingClientOperations = {
  /** Delete-for-me: durable suppression + account event log + projection replay. */
  deleteDmForMe: (
    params: ExecuteLocalDmDeleteForMeParams & Readonly<{
      replayProjection?: boolean;
      skipEventLogReconcile?: boolean;
    }>,
  ): Promise<ReadonlyArray<string>> => (
    gateway().localDmVisibility.executeDeleteForMe(params)
  ),

  showDmOnDeviceAgain: (
    params: ExecuteLocalDmShowAgainParams,
  ): Promise<ReadonlyArray<string>> => (
    gateway().localDmVisibility.executeShowAgainOnDevice(params)
  ),

  /** Suppression only (no event-log reconcile). Requires conversation scope. */
  persistDmSuppressionOnly: (
    params: PersistLocalDmSuppressionParams,
  ): Promise<ReadonlyArray<string>> => (
    gateway().localDmVisibility.persistSuppressionStores(params)
  ),

  prepareDmThreadSuppressionIds: (
    params: PrepareDmThreadSuppressionParams,
  ): Promise<Set<string>> => materialization().prepareThreadSuppressionIds(params),

  filterDmThreadMessagesBySuppression: (
    messages: ReadonlyArray<Message>,
    suppressedIds: ReadonlySet<string>,
  ): ReadonlyArray<Message> => materialization().filterThreadMessagesBySuppression(messages, suppressedIds),

  mergeDmHydratedBaseWithLiveOverlay: (
    baseHydrated: ReadonlyArray<Message>,
    liveOverlay: ReadonlyArray<Message>,
    overlayConversationScope: ReadonlySet<string>,
  ): ReadonlyArray<Message> => materialization().mergeHydratedBaseWithLiveOverlay(
    baseHydrated,
    liveOverlay,
    overlayConversationScope,
  ),

  hydrateDmThreadReadModel: (
    params: RunDmConversationHydrateReadModelPipelineParams,
  ) => materialization().hydrateThreadReadModel(params),

  buildProjectionEvidenceMessages: (
    params: BuildProjectionEvidenceMessagesParams,
  ): ReadonlyArray<Message> => materialization().buildProjectionEvidenceMessages(params),

  mergeProjectionWithLiveOverlay: (
    params: Parameters<DmConversationMaterializationPort["mergeProjectionWithLiveOverlay"]>[0],
  ) => materialization().mergeProjectionWithLiveOverlay(params),

  applyRealtimeBufferedEvents: (
    params: Parameters<DmConversationMaterializationPort["applyRealtimeBufferedEvents"]>[0],
  ): ReadonlyArray<Message> => materialization().applyRealtimeBufferedEvents(params),

  loadEarlierDmMessages: (
    params: Parameters<DmConversationMaterializationPort["loadEarlierMessages"]>[0],
  ) => materialization().loadEarlierMessages(params),

  filterVisibleDmMessages: <T extends MessageLikeWithIdentity>(
    messages: ReadonlyArray<T>,
    profileId: string,
  ): ReadonlyArray<T> => gateway().localDmVisibility.filterVisibleMessages(messages, profileId),

  messageDeleteTombstonesPort: (): MessageDeleteTombstonesPersistencePort => (
    gateway().messageDeleteTombstones
  ),

  loadDmSuppressedIdentityIds: (
    profileId?: string,
    nowMs: number = Date.now(),
  ): ReadonlySet<string> => (
    gateway().messageDeleteTombstones.loadSuppressedMessageDeleteIds(nowMs, profileId)
  ),

  isDmMessageSuppressed: (
    messageId: string,
    profileId?: string,
    nowMs: number = Date.now(),
  ): boolean => (
    gateway().messageDeleteTombstones.isMessageDeleteSuppressed(messageId, nowMs, profileId)
  ),

  isDmMessageIdentitySuppressed: (
    message: MessageLikeWithIdentity,
    profileId?: string,
    nowMs: number = Date.now(),
  ): boolean => {
    const id = message.id?.trim() ?? "";
    if (id.length > 0 && gateway().messageDeleteTombstones.isMessageDeleteSuppressed(id, nowMs, profileId)) {
      return true;
    }
    const eventId = message.eventId?.trim() ?? "";
    if (eventId.length > 0
      && gateway().messageDeleteTombstones.isMessageDeleteSuppressed(eventId, nowMs, profileId)) {
      return true;
    }
    const relayPublishedEventId = message.relayPublishedEventId?.trim() ?? "";
    return relayPublishedEventId.length > 0
      && gateway().messageDeleteTombstones.isMessageDeleteSuppressed(relayPublishedEventId, nowMs, profileId);
  },

  ensureLocalDmVisibilityReady: (
    scope: LocalDmVisibilityScope,
  ): Promise<void> => gateway().localDmVisibility.ensureReady(scope),

  reconcileAccountEventLog: (params: Readonly<{
    profileId: string;
    accountPublicKeyHex: string;
    extraMessageIds?: ReadonlyArray<string>;
    replayProjection?: boolean;
  }>) => gateway().localDmVisibility.reconcileAccountEventLog(params),

  hydrateDmTombstonesFromSqlite: (
    profileId: string,
  ): Promise<void> => gateway().messageDeleteTombstones.hydrateMessageDeleteTombstonesFromSqlite(profileId),

  loadDmTombstoneEntries: (
    nowMs: number = Date.now(),
    profileId?: string,
  ): ReadonlyArray<MessageDeleteTombstoneEntry> => (
    gateway().messageDeleteTombstones.loadMessageDeleteTombstoneEntries(nowMs, profileId)
  ),

  replaceDmTombstoneEntries: (
    entries: ReadonlyArray<MessageDeleteTombstoneEntry>,
    nowMs: number = Date.now(),
    profileId?: string,
  ): void => {
    gateway().messageDeleteTombstones.replaceMessageDeleteTombstones(entries, nowMs, profileId);
  },

  /**
   * Message-bus / realtime UI path: persist durable delete-for-me suppression
   * using the same owner as explicit user deletes (without full reconcile).
   */
  recordMessageBusDeletedIdentities: async (params: Readonly<{
    conversationId: string;
    messageIdentityIds: ReadonlyArray<string>;
    deletedAtUnixMs?: number;
    profileId?: string;
    accountPublicKeyHex?: PublicKeyHex;
  }>): Promise<ReadonlyArray<string>> => {
    const profileId = params.profileId?.trim() || getResolvedProfileId() || "";
    if (!profileId) {
      return [];
    }
    return gateway().localDmVisibility.persistSuppressionStores({
      conversationId: params.conversationId,
      messageIdentityIds: params.messageIdentityIds,
      profileId,
      deletedAtUnixMs: params.deletedAtUnixMs,
    });
  },
} as const;
