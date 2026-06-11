export type CommunityInvitePreJoinRosterCopy = Readonly<{
  accessLabel: string;
  rosterSummary: string;
  showMemberCountBadge: boolean;
  memberCount?: number;
  privacyHint: string;
}>;

const formatCommunityInviteAccessLabel = (access: string | undefined): string => {
  switch (access) {
    case "open":
      return "Open";
    case "discoverable":
      return "Discoverable";
    case "invite-only":
      return "Invite-only";
    case "private":
      return "Private";
    default:
      return "Private";
  }
};

/** Pre-join invites must not imply an empty roster when membership is simply hidden. */
export const resolveCommunityInvitePreJoinRosterCopy = (params: Readonly<{
  access?: string;
  memberCount?: number;
}>): CommunityInvitePreJoinRosterCopy => {
  const accessLabel = formatCommunityInviteAccessLabel(params.access);
  const canShowMemberCount = (
    params.access === "open"
    && typeof params.memberCount === "number"
    && params.memberCount > 0
  );

  return {
    accessLabel,
    rosterSummary: canShowMemberCount
      ? `${params.memberCount} members`
      : "Roster private until you join",
    showMemberCountBadge: canShowMemberCount,
    memberCount: canShowMemberCount ? params.memberCount : undefined,
    privacyHint: canShowMemberCount
      ? "Accept to view the full member roster in this community."
      : "Member names and roster details stay private until you accept and join.",
  };
};
