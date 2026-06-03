export type GroupListAuthority = "sqlite" | "persisted";

export type GroupListAuthorityReason = "sqlite_native" | "persisted_fallback";

export type ResolveGroupListAuthorityParams = Readonly<{
  /** Native desktop/mobile — SQLite is group list authority. */
  isNativeRuntime: boolean;
}>;

export type GroupListAuthorityDecision = Readonly<{
  authority: GroupListAuthority;
  reason: GroupListAuthorityReason;
}>;

export const resolveGroupListAuthority = (
  params: ResolveGroupListAuthorityParams,
): GroupListAuthorityDecision => {
  if (params.isNativeRuntime) {
    return {
      authority: "sqlite",
      reason: "sqlite_native",
    };
  }
  return {
    authority: "persisted",
    reason: "persisted_fallback",
  };
};
