/**
 * DM Read Authority Contract
 *
 * Defines the single canonical owner for DM conversation message reads.
 * Per AGENTS.md Rule 1: One owner per lifecycle/state/transport path — never add a second.
 *
 * Canonical Owner: Account Projection (via account-sync projection system)
 * Fallback Owners (diagnostics-only, to be deprecated):
 *   - IndexedDB message store (legacy, for recovery scenarios only)
 *   - chat-state-store persistence (legacy, compatibility mode only)
 *
 * Non-Goals:
 *   - Do NOT allow multiple sources to compete as truth in production.
 *   - Do NOT silently degrade from projection to legacy without explicit diagnostics.
 */

import type { Message } from "../types";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

export type DmReadAuthoritySource = "projection" | "indexed_recovery" | "legacy_persisted" | "none";

export type DmReadAuthorityReason =
  | "projection_ready"
  | "projection_empty_recovery_from_indexed"
  | "projection_empty_recovery_from_legacy"
  | "projection_drift_fallback_blocked"
  | "no_identity"
  | "no_conversation_id";

export type DmReadAuthorityStatus = Readonly<{
  source: DmReadAuthoritySource;
  reason: DmReadAuthorityReason;
  isCanonical: boolean;
  diagnostics: Readonly<{
    projectionMessageCount: number;
    indexedMessageCount: number;
    legacyPersistedCount: number;
    scopeVerified: boolean;
  }>;
}>;

export type DmReadAuthorityParams = Readonly<{
  identityPubkey: PublicKeyHex | null;
  conversationId: string | null;
  projectionMessages: ReadonlyArray<Message>;
  indexedMessages: ReadonlyArray<Message>;
  legacyPersistedMessages: ReadonlyArray<Message>;
  projectionReady: boolean;
  scopeVerified: boolean;
  allowIndexedRecovery: boolean;
  allowLegacyRecovery: boolean;
}>;

/**
 * Resolves the single canonical DM read authority.
 *
 * Rules:
 * 1. If projection is ready and has messages, use projection (canonical).
 * 2. If projection is ready but empty, allow indexed recovery (diagnostics).
 * 3. If indexed is empty, allow legacy persisted recovery (diagnostics, deprecated).
 * 4. If projection has drift/critical issues, block reads and emit diagnostics.
 * 5. Never silently mix sources without explicit authority decision.
 */
export const resolveDmReadAuthority = (params: DmReadAuthorityParams): DmReadAuthorityStatus => {
  const projectionMessageCount = params.projectionMessages.length;
  const indexedMessageCount = params.indexedMessages.length;
  const legacyPersistedCount = params.legacyPersistedMessages.length;

  const diagnostics = {
    projectionMessageCount,
    indexedMessageCount,
    legacyPersistedCount,
    scopeVerified: params.scopeVerified,
  };

  // Identity check
  if (!params.identityPubkey) {
    return {
      source: "none",
      reason: "no_identity",
      isCanonical: false,
      diagnostics,
    };
  }

  // Conversation ID check
  if (!params.conversationId) {
    return {
      source: "none",
      reason: "no_conversation_id",
      isCanonical: false,
      diagnostics,
    };
  }

  // Scope verification check
  if (!params.scopeVerified) {
    return {
      source: "none",
      reason: "projection_drift_fallback_blocked",
      isCanonical: false,
      diagnostics,
    };
  }

  // Canonical path: projection ready with messages
  if (params.projectionReady && projectionMessageCount > 0) {
    return {
      source: "projection",
      reason: "projection_ready",
      isCanonical: true,
      diagnostics,
    };
  }

  // Recovery path 1: indexed messages (explicit opt-in only)
  if (params.allowIndexedRecovery && indexedMessageCount > 0) {
    return {
      source: "indexed_recovery",
      reason: "projection_empty_recovery_from_indexed",
      isCanonical: false,
      diagnostics,
    };
  }

  // Recovery path 2: legacy persisted (explicit opt-in only, deprecated)
  if (params.allowLegacyRecovery && legacyPersistedCount > 0) {
    return {
      source: "legacy_persisted",
      reason: "projection_empty_recovery_from_legacy",
      isCanonical: false,
      diagnostics,
    };
  }

  // Default: projection (empty is valid state)
  return {
    source: "projection",
    reason: "projection_ready",
    isCanonical: true,
    diagnostics,
  };
};

/**
 * Selects messages based on resolved authority.
 * Never mixes sources - returns exactly one source's messages.
 */
export const selectMessagesByAuthority = (
  params: DmReadAuthorityParams,
): ReadonlyArray<Message> => {
  const authority = resolveDmReadAuthority(params);

  switch (authority.source) {
    case "projection":
      return params.projectionMessages;
    case "indexed_recovery":
      return params.indexedMessages;
    case "legacy_persisted":
      return params.legacyPersistedMessages;
    case "none":
    default:
      return [];
  }
};

/**
 * Checks if the current authority is the canonical projection path.
 * Use this to emit warnings when non-canonical paths are active.
 */
export const isCanonicalDmReadPath = (status: DmReadAuthorityStatus): boolean => (
  status.isCanonical && status.source === "projection"
);

/**
 * Formats authority status for diagnostics logging.
 */
export const formatDmReadAuthorityForDiagnostics = (
  status: DmReadAuthorityStatus,
): string => {
  const canonicalTag = status.isCanonical ? "[CANONICAL]" : "[NON-CANONICAL]";
  const d = status.diagnostics;
  return (
    `${canonicalTag} DM Read Authority: source=${status.source}, ` +
    `reason=${status.reason}, ` +
    `projection=${d.projectionMessageCount}, ` +
    `indexed=${d.indexedMessageCount}, ` +
    `legacy=${d.legacyPersistedCount}, ` +
    `scope=${d.scopeVerified}`
  );
};
