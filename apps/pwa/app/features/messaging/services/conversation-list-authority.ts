export type ConversationListAuthority = "sqlite" | "projection" | "persisted";

export type ConversationListAuthorityReason =
  | "sqlite_native"
  | "projection_read_cutover"
  | "legacy_richer_than_projection"
  | "persisted_fallback";

export type ResolveConversationListAuthorityParams = Readonly<{
  /** Native desktop/mobile — SQLite is always list authority. */
  isNativeRuntime: boolean;
  sqliteConversationCount: number;
  useProjectionReads: boolean;
  projectionConversationCount: number;
  legacyChatStateHasRicherDmContent?: boolean;
}>;

export type ConversationListAuthorityDecision = Readonly<{
  authority: ConversationListAuthority;
  reason: ConversationListAuthorityReason;
}>;

export const resolveConversationListAuthority = (
  params: ResolveConversationListAuthorityParams,
): ConversationListAuthorityDecision => {
  if (params.isNativeRuntime) {
    return {
      authority: "sqlite",
      reason: "sqlite_native",
    };
  }
  if (params.legacyChatStateHasRicherDmContent) {
    return {
      authority: "persisted",
      reason: "legacy_richer_than_projection",
    };
  }
  if (params.useProjectionReads && params.projectionConversationCount > 0) {
    return {
      authority: "projection",
      reason: "projection_read_cutover",
    };
  }
  return {
    authority: "persisted",
    reason: "persisted_fallback",
  };
};
