import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { PrivacySettingsService } from "@/app/features/settings/services/privacy-settings-service";
import { relayListInternals } from "@/app/features/relays/hooks/use-relay-list";
import { logAppEvent } from "@/app/shared/log-app-event";
import { chatStateStoreService } from "@/app/features/messaging/services/chat-state-store";
import { messagePersistenceService } from "@/app/features/messaging/services/message-persistence-service";
import type { PersistedChatState } from "@/app/features/messaging/types";
import {
  replaceMessageDeleteTombstones,
} from "@/app/features/messaging/services/message-delete-tombstone-store";
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
  replaceMessageDeleteTombstones(params.mergedPayload.messageDeleteTombstones ?? []);
  saveCommunityMembershipLedger(params.publicKeyHex, params.mergedPayload.communityMembershipLedger ?? []);
  await params.applyRoomKeySnapshots(params.mergedPayload.roomKeys ?? []);
  PrivacySettingsService.saveSettings(params.mergedPayload.privacySettings);
  relayListInternals.saveRelayListToStorage(params.publicKeyHex, params.mergedPayload.relayList);
  params.persistUiSettingsSnapshot(params.profileId, params.mergedPayload.uiSettings);

  const mergedPayloadChatDiagnostics = params.summarizeChatStateDiagnostics(
    params.mergedPayload.chatState,
    params.publicKeyHex,
  );

  if (params.options?.restoreChatStateDomains && params.mergedPayload.chatState) {
    const restoredChatState = params.options?.restoreDmChatStateDomains === false
      ? stripDmDomainsFromChatState(params.mergedPayload.chatState)
      : params.mergedPayload.chatState;
    const restoredChatStateDiagnostics = params.summarizeChatStateDiagnostics(
      restoredChatState,
      params.publicKeyHex,
    );
    chatStateStoreService.replace(params.publicKeyHex, restoredChatState, {
      emitMutationSignal: false,
      profileId: params.profileId,
    });
    await messagePersistenceService.migrateFromLegacy(params.publicKeyHex, { profileId: params.profileId });
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

    // After chat state is restored, recover missing media from CAS
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
      appliedRoomKeyCount: (params.mergedPayload.roomKeys ?? []).length,
      appliedMessageDeleteTombstoneCount: params.mergedPayload.messageDeleteTombstones?.length ?? 0,
      ...params.buildPrefixedChatStateDiagnosticsContext(
        "applied",
        params.options?.restoreDmChatStateDomains === false && params.mergedPayload.chatState
          ? params.summarizeChatStateDiagnostics(
            stripDmDomainsFromChatState(params.mergedPayload.chatState),
            params.publicKeyHex,
          )
          : mergedPayloadChatDiagnostics,
      ),
    },
  });
};
