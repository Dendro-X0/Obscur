import { roomKeyStore } from "@/app/features/crypto/room-key-store";
import { isCoordinationOnlyWorkspaceDevMode } from "./community-dev-flags";
import { hasWritableCommunityRelayTransport } from "./community-relay-transport";
import { isRelayAuthoritativeMembershipEnforced } from "./community-relay-authoritative-membership-policy";
import type { WorkspaceMembershipActivationResult } from "./community-workspace-activation";

export type ManagedWorkspaceJoinPredicateInput = Readonly<{
  roomKeyPresent: boolean;
  coordinationSynced: boolean;
  coordinationActorActive: boolean;
  activation: WorkspaceMembershipActivationResult;
}>;

/** Pure join success gate used by the membership port and unit tests (R1 J-5/J-6). */
export const isManagedWorkspaceJoinSuccessful = (
  input: ManagedWorkspaceJoinPredicateInput,
): boolean => {
  if (!input.roomKeyPresent) {
    return false;
  }

  const coordinationJoinConfirmed = input.coordinationSynced || input.coordinationActorActive;
  const relaySynced = input.activation.relay.status === "synced";
  const devCoordinationOnly = isCoordinationOnlyWorkspaceDevMode();
  const writableRelayUrl = hasWritableCommunityRelayTransport(
    input.activation.relay.canonicalUrl,
  );

  if (
    isRelayAuthoritativeMembershipEnforced()
    && !relaySynced
    && !coordinationJoinConfirmed
    && !devCoordinationOnly
  ) {
    return false;
  }

  // R4: full-stack profiles require relay publish evidence when URL is writable.
  if (!devCoordinationOnly && writableRelayUrl && !relaySynced) {
    return false;
  }

  if (input.activation.summary.severity !== "success" && !coordinationJoinConfirmed) {
    return false;
  }

  return coordinationJoinConfirmed || input.activation.summary.severity === "success";
};

export const rollbackJoinRoomKeyAttempt = async (
  groupId: string,
  priorRoomKeyHex: string | null,
): Promise<void> => {
  if (priorRoomKeyHex?.trim()) {
    await roomKeyStore.saveRoomKey(groupId, priorRoomKeyHex.trim());
    return;
  }
  await roomKeyStore.deleteRoomKey(groupId);
};
