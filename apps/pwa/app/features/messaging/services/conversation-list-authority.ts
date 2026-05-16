export type ConversationListAuthority = "sqlite" | "projection" | "persisted";

export type ConversationListAuthorityReason =
  | "sqlite_tauri"
  | "projection_read_cutover"
  | "legacy_richer_than_projection"
  | "persisted_fallback";

export type ResolveConversationListAuthorityParams = Readonly<{
  isTauri: boolean;
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
  if (params.isTauri && params.sqliteConversationCount > 0) {
    return {
      authority: "sqlite",
      reason: "sqlite_tauri",
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
