import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { logAppEvent } from "@/app/shared/log-app-event";
import { clearCommunityProvisionalMembershipRecord } from "./community-provisional-membership-cache";

/** Interval for stealth membership restate publishes while a community view is active. */
export const COMMUNITY_MEMBERSHIP_RESTATE_INTERVAL_MS = 90_000;

/** Debounced auto-reconcile when opening community surfaces. */
export const COMMUNITY_MEMBERSHIP_AUTO_RECONCILE_DEBOUNCE_MS = 2_000;

export type CommunityMembershipReconcileParams = Readonly<{
  groupId: string;
  relayUrl: string;
  profileId?: string;
  refreshRelaySubscription: () => void;
}>;

/** Clears provisional overlay and reopens relay membership subscription. */
export const reconcileCommunityMembershipEvidence = (params: CommunityMembershipReconcileParams): void => {
  const groupId = params.groupId.trim();
  const relayUrl = params.relayUrl.trim();
  if (!groupId || !relayUrl) {
    return;
  }
  clearCommunityProvisionalMembershipRecord({
    groupId,
    relayUrl,
    profileId: params.profileId,
  });
  params.refreshRelaySubscription();
  logAppEvent({
    name: "groups.membership_evidence.reconcile",
    level: "info",
    scope: { feature: "groups", action: "membership_evidence_reconcile" },
    context: { groupId, relayUrl },
  });
};

export type CommunityMembershipClearTerminalParams = Readonly<{
  groupId: string;
  relayUrl: string;
  clearLocalTerminalMembershipEvidence: () => void;
  refreshRelaySubscription: () => void;
}>;

/** Clears local terminal left/expel overlay and refreshes relay subscription. */
export const clearCommunityTerminalMembershipEvidence = (params: CommunityMembershipClearTerminalParams): void => {
  const groupId = params.groupId.trim();
  const relayUrl = params.relayUrl.trim();
  if (!groupId || !relayUrl) {
    return;
  }
  params.clearLocalTerminalMembershipEvidence();
  params.refreshRelaySubscription();
  logAppEvent({
    name: "groups.membership_evidence.clear_terminal",
    level: "warn",
    scope: { feature: "groups", action: "membership_evidence_clear_terminal" },
    context: { groupId, relayUrl, profileId: getResolvedProfileId() },
  });
};
