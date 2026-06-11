import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { dbDeleteMessage, dbDeleteMessages, isTauri } from "@dweb/db";
import { messagingDB } from "@dweb/storage/indexed-db";
import { PrivacySettingsService } from "@/app/features/settings/services/privacy-settings-service";
import { relayListInternals } from "@/app/features/relays/hooks/use-relay-list";
import { logAppEvent } from "@/app/shared/log-app-event";
import { chatStateStoreService } from "@/app/features/messaging/services/chat-state-store";
import { messagePersistenceService } from "@/app/features/messaging/services/message-persistence-service";
import type { PersistedChatState } from "@/app/features/messaging/types";
import { messagingClientOperations } from "@/app/features/messaging/services/messaging-client-operations";
import {
  saveCommunityMembershipLedger,
} from "@/app/features/groups/services/community-membership-ledger";
import type { EncryptedAccountBackupPayload, RoomKeySnapshot } from "../account-sync-contracts";
import type {
  BackupRestoreHistoryRegressionStage,
  ChatStateMessageDiagnostics,
} from "./restore-diagnostics";
import {
  recoverMissingMediaFromCAS,
  checkMediaRecoveryNeeded,
} from "@/app/features/vault/services/cas-media-recovery";
import { relinkChatStateMediaAfterRestore } from "@/app/features/messaging/services/media-cas-message-integration";
import {
  withAccountRestoreMaterializationEvents,
} from "./restore-materialization-events";
import { resolveRestoreMaterializationSuppressionContract } from "./restore-materialization-suppression-contract";
import { stripChatStateMessageBodiesForNativeMirror } from "./restore-merge-chat-state";
import { applyNativeRestoreSqliteMaterialization } from "./native-sqlite-backup-evidence";

const purgeSuppressedMessageIdentitiesFromDurableStores = async (
  profileId: string,
  deleteIds: ReadonlyArray<string>,
): Promise<void> => {
  const normalizedIds = Array.from(new Set(deleteIds.map((id) => id.trim()).filter((id) => id.length > 0)));
  if (normalizedIds.length === 0) {
    return;
  }
  await Promise.all(normalizedIds.map((deleteId) => (
    messagingDB.delete("messages", deleteId).catch(() => undefined)
  )));
  if (!isTauri()) {
    return;
  }
  try {
    await dbDeleteMessages(normalizedIds, profileId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("db_delete_messages")) {
      await Promise.all(normalizedIds.map((deleteId) => (
        dbDeleteMessage(deleteId, profileId).catch(() => undefined)
      )));
    }
  }
};

export type NonV1RestoreMaterializationOptions = Readonly<{
  restoreChatStateDomains?: boolean;
  restoreDmChatStateDomains?: boolean;
}>;

export const stripDmDomainsFromChatState = (chatState: PersistedChatState): PersistedChatState => ({
  ...chatState,
  // Keep DM sidebar/request metadata available for now so fresh-device UI can
  // still render contacts/conversation rows while DM message truth itself moves
  // toward canonical import/projection ownership.
  messagesByConversationId: Object.fromEntries(
    Object.entries(chatState.messagesByConversationId).filter(([conversationId]) => (
      conversationId.startsWith("community:") || conversationId.startsWith("group:") || conversationId.includes("@")
    )),
  ),
});

export const applyNonV1RestoreMaterialization = async (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  mergedPayload: EncryptedAccountBackupPayload;
  profileId: string;
  options?: NonV1RestoreMaterializationOptions;
  summarizeChatStateDiagnostics: (
    chatState: PersistedChatState | null | undefined,
    publicKeyHex: PublicKeyHex,
  ) => ChatStateMessageDiagnostics;
  buildPrefixedChatStateDiagnosticsContext: (
    prefix: string,
    diagnostics: ChatStateMessageDiagnostics,
  ) => Readonly<Record<string, string | number | boolean | null>>;
  emitRestoreHistoryRegression: (params: Readonly<{
    publicKeyHex: PublicKeyHex;
    stage: BackupRestoreHistoryRegressionStage;
    from: ChatStateMessageDiagnostics;
    to: ChatStateMessageDiagnostics;
    restorePath: "non_v1_domains";
    restoreChatStateDomains: true;
  }>) => void;
  applyRoomKeySnapshots: (roomKeys: ReadonlyArray<RoomKeySnapshot>) => Promise<void>;
  persistUiSettingsSnapshot: (
    profileId: string,
    uiSettings: EncryptedAccountBackupPayload["uiSettings"],
  ) => void;
}>): Promise<void> => {
  await withAccountRestoreMaterializationEvents({
    publicKeyHex: params.publicKeyHex,
    profileId: params.profileId,
  }, async () => {
    const {
      mergedTombstoneEntries,
      durableDeleteIds,
      materializedPayload,
    } = await resolveRestoreMaterializationSuppressionContract({
      publicKeyHex: params.publicKeyHex,
      profileId: params.profileId,
      mergedPayload: params.mergedPayload,
    });

    await messagingClientOperations.replaceDmTombstoneEntries(
      mergedTombstoneEntries,
      Date.now(),
      params.profileId,
    );
    saveCommunityMembershipLedger(params.publicKeyHex, materializedPayload.communityMembershipLedger ?? [], {
      profileId: params.profileId,
    });
    await params.applyRoomKeySnapshots(materializedPayload.roomKeys ?? []);
    PrivacySettingsService.saveSettings(materializedPayload.privacySettings);
    relayListInternals.saveRelayListToStorage(params.publicKeyHex, materializedPayload.relayList, params.profileId);
    params.persistUiSettingsSnapshot(params.profileId, materializedPayload.uiSettings);

    const mergedPayloadChatDiagnostics = params.summarizeChatStateDiagnostics(
      materializedPayload.chatState,
      params.publicKeyHex,
    );

    if (params.options?.restoreChatStateDomains && materializedPayload.chatState) {
      let restoredChatState = params.options?.restoreDmChatStateDomains === false
        ? stripDmDomainsFromChatState(materializedPayload.chatState)
        : materializedPayload.chatState;
      if (isTauri()) {
        restoredChatState = stripChatStateMessageBodiesForNativeMirror(restoredChatState)!;
      }
      const restoredChatStateDiagnostics = params.summarizeChatStateDiagnostics(
        restoredChatState,
        params.publicKeyHex,
      );
      chatStateStoreService.replace(params.publicKeyHex, restoredChatState, {
        emitMutationSignal: false,
        profileId: params.profileId,
      });
      if (isTauri()) {
        await applyNativeRestoreSqliteMaterialization({
          profileId: params.profileId,
          chatState: restoredChatState,
          nativeSqliteEvidence: materializedPayload.nativeSqliteEvidence,
        });
      }
      relinkChatStateMediaAfterRestore(
        params.profileId,
        params.publicKeyHex,
        restoredChatState,
      );
      await messagePersistenceService.migrateFromLegacy(params.publicKeyHex, { profileId: params.profileId });
      await purgeSuppressedMessageIdentitiesFromDurableStores(
        params.profileId,
        Array.from(durableDeleteIds),
      );
      const storedChatStateDiagnostics = params.summarizeChatStateDiagnostics(
        chatStateStoreService.load(params.publicKeyHex),
        params.publicKeyHex,
      );
      params.emitRestoreHistoryRegression({
        publicKeyHex: params.publicKeyHex,
        stage: "merged_to_applied_store",
        from: restoredChatStateDiagnostics,
        to: storedChatStateDiagnostics,
        restorePath: "non_v1_domains",
        restoreChatStateDomains: true,
      });

      const recoveryNeeded = await checkMediaRecoveryNeeded(params.publicKeyHex);
      if (recoveryNeeded) {
        await recoverMissingMediaFromCAS(params.publicKeyHex, {
          maxConcurrentFetches: 3,
        });
      }
    }

    logAppEvent({
      name: "account_sync.backup_restore_apply_diagnostics",
      level: "info",
      scope: { feature: "account_sync", action: "backup_restore" },
      context: {
        publicKeySuffix: params.publicKeyHex.slice(-8),
        restorePath: "non_v1_domains",
        restoreChatStateDomains: params.options?.restoreChatStateDomains === true,
        restoreDmChatStateDomains: params.options?.restoreDmChatStateDomains !== false,
        ...params.buildPrefixedChatStateDiagnosticsContext(
          "merged",
          mergedPayloadChatDiagnostics,
        ),
        appliedRoomKeyCount: (materializedPayload.roomKeys ?? []).length,
        appliedMessageDeleteTombstoneCount: mergedTombstoneEntries.length,
        ...params.buildPrefixedChatStateDiagnosticsContext(
          "applied",
          params.options?.restoreDmChatStateDomains === false && materializedPayload.chatState
            ? params.summarizeChatStateDiagnostics(
              stripDmDomainsFromChatState(materializedPayload.chatState),
              params.publicKeyHex,
            )
            : mergedPayloadChatDiagnostics,
        ),
      },
    });
  });
};
