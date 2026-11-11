/**
 * Cut 7.3 — Continuity T3 authority + CRM invention law.
 * Sticky CRM / native SQLite wins; chat-state must not mint TRUSTED alone.
 * ≠ Continuity Pass · ≠ Soft L3 Fixed.
 * @see specs/backend/cut7-continuity-m1-sealed-file-design-2026-11-10.md
 */

export const CHAT_STATE_AS_SOLE_CRM_REFUSED = "chat_state_as_sole_crm_refused" as const;

export type ContinuityT3Authority = "sqlite" | "chat_state_partial" | "none";

export type ContinuityCrmAuthority = "sticky_crm" | "sqlite_residue" | "none";

export const resolveContinuityT3Authority = (params: Readonly<{
  isNativeRuntime: boolean;
  hasNativeSqliteEvidence: boolean;
  hasChatStateMessages: boolean;
}>): ContinuityT3Authority => {
  if (params.isNativeRuntime && params.hasNativeSqliteEvidence) {
    return "sqlite";
  }
  if (params.hasChatStateMessages) {
    return "chat_state_partial";
  }
  return "none";
};

/**
 * CRM (T1) authority: sticky peerTrust first; optional native SQLite residue bridge;
 * never invent accepted peers from chat-state alone.
 */
export const resolveContinuityCrmAuthority = (params: Readonly<{
  stickyAcceptedPeerCount: number;
  nativeSqlitePeerHintCount: number;
  chatStatePeerHintCount: number;
}>): Readonly<{
  authority: ContinuityCrmAuthority;
  refusedChatStateInvention: boolean;
  reasonCode?: typeof CHAT_STATE_AS_SOLE_CRM_REFUSED;
}> => {
  if (params.stickyAcceptedPeerCount > 0) {
    return {
      authority: "sticky_crm",
      refusedChatStateInvention: params.chatStatePeerHintCount > 0,
      ...(params.chatStatePeerHintCount > 0
        ? { reasonCode: CHAT_STATE_AS_SOLE_CRM_REFUSED }
        : {}),
    };
  }
  if (params.nativeSqlitePeerHintCount > 0) {
    return {
      authority: "sqlite_residue",
      refusedChatStateInvention: params.chatStatePeerHintCount > 0,
      ...(params.chatStatePeerHintCount > 0
        ? { reasonCode: CHAT_STATE_AS_SOLE_CRM_REFUSED }
        : {}),
    };
  }
  if (params.chatStatePeerHintCount > 0) {
    return {
      authority: "none",
      refusedChatStateInvention: true,
      reasonCode: CHAT_STATE_AS_SOLE_CRM_REFUSED,
    };
  }
  return { authority: "none", refusedChatStateInvention: false };
};

/** Always refuse minting TRUSTED solely from chat-state lookback. */
export const mayInventAcceptedPeersFromChatStateAlone = (): false => false;
