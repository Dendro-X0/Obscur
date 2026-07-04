import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { CoordinationMembershipMaterialization } from "./community-coordination-membership-materializer";

export type CommunityMembershipHealthBlocker =
  | "room_key_missing"
  | "coordination_stale"
  | "coordination_missing_peer"
  | "relay_not_writable"
  | "relay_not_connected"
  | "activation_pending";

export type CommunityMembershipHealthRecoveryAction =
  | "invite_redemption"
  | "reconcile"
  | "configure_relays"
  | "retry_join";

export type CommunityMembershipHealth = Readonly<{
  ready: boolean;
  blockers: ReadonlyArray<CommunityMembershipHealthBlocker>;
  recoveryActions: ReadonlyArray<CommunityMembershipHealthRecoveryAction>;
  /** Dev-only: coordination-only mode without chat */
  chatEnabled: boolean;
}>;

export type ResolveCommunityMembershipHealthParams = Readonly<{
  communityId?: string;
  localMemberPubkey?: PublicKeyHex | null;
  coordinationDirectory: CoordinationMembershipMaterialization | null;
  roomKeyPresent: boolean;
  relayTransportReady: boolean;
  relayActivationSynced: boolean;
  activationPending: boolean;
  devCoordinationOnly: boolean;
  requireCoordinationDirectory?: boolean;
}>;

const uniqueRecoveryActions = (
  actions: ReadonlyArray<CommunityMembershipHealthRecoveryAction>,
): ReadonlyArray<CommunityMembershipHealthRecoveryAction> => (
  Array.from(new Set(actions))
);

const isPubkeyActiveInDirectory = (
  materialization: CoordinationMembershipMaterialization,
  pubkey: PublicKeyHex,
): boolean => {
  const normalized = pubkey.trim().toLowerCase();
  return materialization.activeMemberPubkeys.some(
    (entry) => entry.trim().toLowerCase() === normalized,
  );
};

const relayOnlyBlockers = new Set<CommunityMembershipHealthBlocker>([
  "relay_not_writable",
  "relay_not_connected",
]);

const isNavigationBlocker = (
  blocker: CommunityMembershipHealthBlocker,
): boolean => blocker !== "room_key_missing";

/**
 * Single read model for community membership readiness (R2).
 * Coordination + relay gate navigation; room key is diagnostic only (COM-RUN-02 cancelled).
 */
export const resolveCommunityMembershipHealth = (
  params: ResolveCommunityMembershipHealthParams,
): CommunityMembershipHealth => {
  const blockers: CommunityMembershipHealthBlocker[] = [];
  const recoveryActions: CommunityMembershipHealthRecoveryAction[] = [];

  if (!params.roomKeyPresent) {
    blockers.push("room_key_missing");
    recoveryActions.push("invite_redemption");
  }

  const requireDirectory = params.requireCoordinationDirectory ?? Boolean(params.communityId?.trim());
  if (requireDirectory) {
    if (!params.coordinationDirectory) {
      blockers.push("coordination_stale");
      recoveryActions.push("reconcile");
    } else if (
      params.localMemberPubkey?.trim()
      && !isPubkeyActiveInDirectory(params.coordinationDirectory, params.localMemberPubkey)
    ) {
      blockers.push("coordination_missing_peer");
      recoveryActions.push("retry_join");
    }
  }

  if (!params.relayTransportReady) {
    blockers.push("relay_not_writable");
    recoveryActions.push("configure_relays");
  } else if (!params.relayActivationSynced) {
    blockers.push("relay_not_connected");
    recoveryActions.push("configure_relays");
  }

  if (params.activationPending) {
    blockers.push("activation_pending");
    recoveryActions.push("retry_join");
  }

  const chatEnabled = !params.devCoordinationOnly
    && params.relayTransportReady
    && params.relayActivationSynced;

  const navigationBlockers = blockers.filter(isNavigationBlocker);
  const ready = params.devCoordinationOnly
    ? navigationBlockers.every((blocker) => relayOnlyBlockers.has(blocker))
    : navigationBlockers.length === 0;

  return {
    ready,
    blockers,
    recoveryActions: uniqueRecoveryActions(recoveryActions),
    chatEnabled,
  };
};
