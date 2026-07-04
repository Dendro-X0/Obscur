import type { TFunction } from "i18next";
import type {
  CommunityMembershipHealth,
  CommunityMembershipHealthBlocker,
  CommunityMembershipHealthRecoveryAction,
} from "../services/community-membership-health";

const BLOCKER_KEYS: Record<CommunityMembershipHealthBlocker, string> = {
  room_key_missing: "groups.membershipHealth.blocker.roomKeyMissing",
  coordination_stale: "groups.membershipHealth.blocker.coordinationStale",
  coordination_missing_peer: "groups.membershipHealth.blocker.coordinationMissingPeer",
  relay_not_writable: "groups.membershipHealth.blocker.relayNotWritable",
  relay_not_connected: "groups.membershipHealth.blocker.relayNotConnected",
  activation_pending: "groups.membershipHealth.blocker.activationPending",
};

const RECOVERY_KEYS: Record<CommunityMembershipHealthRecoveryAction, string> = {
  invite_redemption: "groups.membershipHealth.recovery.inviteRedemption",
  reconcile: "groups.membershipHealth.recovery.reconcile",
  configure_relays: "groups.membershipHealth.recovery.configureRelays",
  retry_join: "groups.membershipHealth.recovery.retryJoin",
};

export const resolveCommunityMembershipHealthBlockerCopy = (
  blocker: CommunityMembershipHealthBlocker,
  t: TFunction,
): string => t(BLOCKER_KEYS[blocker]);

export const resolveCommunityMembershipHealthRecoveryCopy = (
  action: CommunityMembershipHealthRecoveryAction,
  t: TFunction,
): string => t(RECOVERY_KEYS[action]);

export const resolveCommunityMembershipHealthSummary = (
  health: CommunityMembershipHealth,
  t: TFunction,
): string => {
  const navigationBlockers = health.blockers.filter((blocker) => blocker !== "room_key_missing");
  if (navigationBlockers.length === 0) {
    const base = health.chatEnabled
      ? t("groups.membershipHealth.summary.ready")
      : t("groups.membershipHealth.summary.coordinationOnly");
    if (
      health.blockers.includes("room_key_missing")
      && !(health.ready && health.chatEnabled)
    ) {
      return `${base} · ${t("groups.membershipHealth.blocker.roomKeyMissing")}`;
    }
    return base;
  }
  return navigationBlockers
    .map((blocker) => resolveCommunityMembershipHealthBlockerCopy(blocker, t))
    .join(" · ");
};

export const resolveCommunityMembershipHealthActionTitle = (
  health: CommunityMembershipHealth,
  t: TFunction,
): string => {
  if (health.recoveryActions.length > 0) {
    return resolveCommunityMembershipHealthRecoveryCopy(health.recoveryActions[0], t);
  }
  return resolveCommunityMembershipHealthSummary(health, t);
};
