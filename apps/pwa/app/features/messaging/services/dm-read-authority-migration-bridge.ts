/**
 * DM Read Authority Migration Bridge
 *
 * Temporary bridge to migrate from conversation-history-authority.ts
 * to dm-read-authority-contract.ts without breaking existing call sites.
 *
 * This bridge:
 * 1. Wraps the old conversation-history-authority logic
 * 2. Translates to the new dm-read-authority-contract format
 * 3. Emits diagnostics for tracking migration progress
 * 4. Will be removed once all call sites migrate
 *
 * @deprecated This bridge is temporary. Migrate directly to dm-read-authority-contract.ts
 * Target removal: v1.5.0
 */

import type { Message } from "../types";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  resolveDmReadAuthority,
  selectMessagesByAuthority,
  type DmReadAuthorityParams,
  type DmReadAuthorityStatus,
} from "./dm-read-authority-contract";
import {
  resolveConversationHistoryAuthority,
  type ResolveConversationHistoryAuthorityParams,
} from "./conversation-history-authority";
import { logAppEvent } from "@/app/shared/log-app-event";

export type MigrationBridgeParams = Readonly<{
  identityPubkey: PublicKeyHex | null;
  conversationId: string | null;
  projectionMessages: ReadonlyArray<Message>;
  indexedMessages: ReadonlyArray<Message>;
  legacyPersistedMessages: ReadonlyArray<Message>;
  projectionReady: boolean;
  scopeVerified: boolean;
  // Legacy compatibility params
  useProjectionReads: boolean;
  projectionIncomingCount: number;
  projectionBootstrapImportApplied: boolean;
  projectionCanonicalEvidencePending: boolean;
  projectionRestorePhaseActive: boolean;
  indexedOutgoingCount: number;
  indexedIncomingCount: number;
  persistedIncomingCount: number;
}>;

let bridgeUsageCount = 0;
const BRIDGE_DIAGNOSTICS_THRESHOLD = 10;

const emitBridgeUsageDiagnostics = (params: MigrationBridgeParams, result: DmReadAuthorityStatus): void => {
  bridgeUsageCount++;
  if (bridgeUsageCount <= BRIDGE_DIAGNOSTICS_THRESHOLD || result.source !== "projection") {
    logAppEvent({
      name: "messaging.dm_read_authority_bridge_used",
      level: result.source === "projection" ? "info" : "warn",
      scope: { feature: "messaging", action: "dm_read_authority_bridge" },
      context: {
        bridgeUsageCount,
        source: result.source,
        reason: result.reason,
        conversationId: params.conversationId ?? null,
        projectionMessageCount: params.projectionMessages.length,
        indexedMessageCount: params.indexedMessages.length,
        legacyPersistedCount: params.legacyPersistedMessages.length,
      },
    });
  }
};

/**
 * Bridge function that translates legacy conversation-history-authority
 * parameters to the new dm-read-authority-contract format.
 *
 * This function:
 * 1. Maps legacy parameters to new canonical parameters
 * 2. Calls the new resolveDmReadAuthority
 * 3. Emits diagnostics for tracking
 * 4. Returns result in new format
 */
export const resolveDmReadAuthorityViaBridge = (
  params: MigrationBridgeParams,
): DmReadAuthorityStatus => {
  // Determine allow flags based on legacy recovery detection
  const legacyAuthority = resolveConversationHistoryAuthority({
    useProjectionReads: params.useProjectionReads,
    projectionMessageCount: params.projectionMessages.length,
    projectionIncomingCount: params.projectionIncomingCount,
    projectionBootstrapImportApplied: params.projectionBootstrapImportApplied,
    projectionCanonicalEvidencePending: params.projectionCanonicalEvidencePending,
    projectionRestorePhaseActive: params.projectionRestorePhaseActive,
    indexedMessageCount: params.indexedMessages.length,
    indexedOutgoingCount: params.indexedOutgoingCount,
    indexedIncomingCount: params.indexedIncomingCount,
    persistedMessageCount: params.legacyPersistedMessages.length,
    persistedOutgoingCount: 0, // Not tracked in legacy
    persistedIncomingCount: params.persistedIncomingCount,
  });

  // Map legacy authority to new allow flags
  const allowIndexedRecovery =
    legacyAuthority.authority === "indexed" ||
    legacyAuthority.reason === "persisted_recovery_indexed_missing_incoming" ||
    legacyAuthority.reason === "persisted_recovery_indexed_missing_outgoing";

  const allowLegacyRecovery = legacyAuthority.authority === "persisted";

  // Build new canonical params
  const newParams: DmReadAuthorityParams = {
    identityPubkey: params.identityPubkey,
    conversationId: params.conversationId,
    projectionMessages: params.projectionMessages,
    indexedMessages: params.indexedMessages,
    legacyPersistedMessages: params.legacyPersistedMessages,
    projectionReady: params.projectionReady,
    scopeVerified: params.scopeVerified,
    allowIndexedRecovery,
    allowLegacyRecovery,
  };

  const result = resolveDmReadAuthority(newParams);
  emitBridgeUsageDiagnostics(params, result);

  return result;
};

/**
 * Selects messages using the bridge pattern.
 * Convenience function that combines authority resolution with message selection.
 */
export const selectMessagesViaBridge = (
  params: MigrationBridgeParams,
): ReadonlyArray<Message> => {
  const authority = resolveDmReadAuthorityViaBridge(params);

  // Build params for selection
  const selectionParams: DmReadAuthorityParams = {
    identityPubkey: params.identityPubkey,
    conversationId: params.conversationId,
    projectionMessages: params.projectionMessages,
    indexedMessages: params.indexedMessages,
    legacyPersistedMessages: params.legacyPersistedMessages,
    projectionReady: params.projectionReady,
    scopeVerified: params.scopeVerified,
    allowIndexedRecovery: authority.source === "indexed_recovery",
    allowLegacyRecovery: authority.source === "legacy_persisted",
  };

  return selectMessagesByAuthority(selectionParams);
};

/**
 * Returns bridge usage statistics for diagnostics.
 */
export const getBridgeUsageStats = (): { usageCount: number; threshold: number } => ({
  usageCount: bridgeUsageCount,
  threshold: BRIDGE_DIAGNOSTICS_THRESHOLD,
});

/**
 * Resets bridge usage counter (for testing).
 */
export const resetBridgeUsageCounter = (): void => {
  bridgeUsageCount = 0;
};
