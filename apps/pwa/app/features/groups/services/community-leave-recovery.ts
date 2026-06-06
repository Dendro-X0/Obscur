/**
 * P5-COM-2 — Recovery owner for spurious local leave when relay publish failed.
 *
 * Leave **publish** state (outbox) is not membership truth. When local hide gates
 * (tombstone + ledger left) exist but persisted group evidence still exists
 * (SQLite / chat-state), membership can be revoked programmatically.
 */

import type { GroupConversation } from "@/app/features/messaging/types";
import { fromPersistedGroupConversation } from "@/app/features/messaging/utils/persistence";
import {
  findCommunityLeaveOutboxItem,
  removeCommunityLeaveOutboxItem,
} from "./community-leave-outbox";
import { loadGroupTombstones, removeGroupTombstone, toGroupTombstoneKey } from "./group-tombstone-store";
import { loadCommunityMembershipLedger } from "./community-membership-ledger";
import { applyCommunityMembershipRuntimeEvidence } from "./community-membership-mutation-owner";
import { loadSqliteGroupPersistedRows } from "./community-group-sqlite-store";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

const hasActiveLeaveOutboxAttempt = (params: Readonly<{
  publicKeyHex: string;
  groupId: string;
  relayUrl: string;
  profileId?: string;
}>): boolean => {
  const item = findCommunityLeaveOutboxItem(params);
  return item?.status === "pending"
    || item?.status === "retrying"
    || item?.status === "rate_limited";
};

export const canRevokeCommunityLeaveTerminalState = (params: Readonly<{
  publicKeyHex: string;
  groupId: string;
  relayUrl: string;
  profileId?: string;
}>): boolean => {
  if (hasActiveLeaveOutboxAttempt(params)) {
    return false;
  }
  const tombstones = loadGroupTombstones(params.publicKeyHex, { profileId: params.profileId });
  return tombstones.has(toGroupTombstoneKey({ groupId: params.groupId, relayUrl: params.relayUrl }));
};

export const revokeCommunityLeaveTerminalState = (params: Readonly<{
  publicKeyHex: string;
  groupId: string;
  relayUrl: string;
  group: GroupConversation;
  profileId: string;
}>): boolean => {
  if (!canRevokeCommunityLeaveTerminalState(params)) {
    return false;
  }
  removeCommunityLeaveOutboxItem({
    publicKeyHex: params.publicKeyHex,
    groupId: params.groupId,
    relayUrl: params.relayUrl,
    profileId: params.profileId,
  });
  removeGroupTombstone(
    params.publicKeyHex,
    { groupId: params.groupId, relayUrl: params.relayUrl },
    { profileId: params.profileId },
  );
  const tombstones = loadGroupTombstones(params.publicKeyHex, { profileId: params.profileId });
  applyCommunityMembershipRuntimeEvidence({
    publicKeyHex: params.publicKeyHex,
    profileId: params.profileId,
    evidence: {
      kind: "user_explicit_rejoin",
      group: params.group,
    },
    membershipLedger: loadCommunityMembershipLedger(params.publicKeyHex, { profileId: params.profileId }),
    tombstones,
  });
  return true;
};

/** Reconstruct a group row from native SQLite when chat-state was cleared on leave. */
export const resolveGroupConversationForLeaveRecovery = async (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  groupId: string;
  relayUrl: string;
  profileId: string;
}>): Promise<GroupConversation | null> => {
  const sqliteRows = await loadSqliteGroupPersistedRows(params.profileId, params.publicKeyHex);
  const match = sqliteRows.find((row) => (
    row.groupId === params.groupId && row.relayUrl === params.relayUrl
  ));
  if (!match) {
    return null;
  }
  return fromPersistedGroupConversation(match);
};

export type RestoreRejectedCommunityLeaveResult = Readonly<{
  restored: ReadonlyArray<GroupConversation>;
  skippedNoPersistedEvidence: number;
}>;

/** Revoke terminal local hide gates when SQLite still holds the group row. */
export const restoreRejectedCommunityLeaveIntents = async (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  profileId: string;
}>): Promise<RestoreRejectedCommunityLeaveResult> => {
  const tombstones = loadGroupTombstones(params.publicKeyHex, { profileId: params.profileId });
  const restored: GroupConversation[] = [];
  let skippedNoPersistedEvidence = 0;

  for (const tombstoneKey of tombstones.keys()) {
    const separatorIndex = tombstoneKey.indexOf("@@");
    if (separatorIndex <= 0) {
      continue;
    }
    const groupId = tombstoneKey.slice(0, separatorIndex);
    const relayUrl = tombstoneKey.slice(separatorIndex + 2);
    if (!canRevokeCommunityLeaveTerminalState({
      publicKeyHex: params.publicKeyHex,
      groupId,
      relayUrl,
      profileId: params.profileId,
    })) {
      continue;
    }
    const group = await resolveGroupConversationForLeaveRecovery({
      publicKeyHex: params.publicKeyHex,
      groupId,
      relayUrl,
      profileId: params.profileId,
    });
    if (!group) {
      skippedNoPersistedEvidence += 1;
      continue;
    }
    const revoked = revokeCommunityLeaveTerminalState({
      publicKeyHex: params.publicKeyHex,
      groupId,
      relayUrl,
      group,
      profileId: params.profileId,
    });
    if (revoked) {
      restored.push(group);
    }
  }

  return { restored, skippedNoPersistedEvidence };
};
