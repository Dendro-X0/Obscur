import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { CommunityMode } from "../types";
import type { GroupConversation } from "@/app/features/messaging/types";
import { roomKeyStore } from "@/app/features/crypto/room-key-store";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { GroupService } from "./group-service";
import { publishCoordinationMembershipDelta } from "./community-coordination-membership-client";
import { resolveCommunityAutoDisbandOnLeaveDecision } from "./community-auto-disband-policy";
import { hasWritableCommunityRelayTransport } from "./community-relay-transport";
import { isRelayAuthoritativeMembershipEnforced } from "./community-relay-authoritative-membership-policy";
import {
  enqueueCommunityLeaveOutboxItem,
  recordCommunityLeaveRelayPublishOutcome,
} from "./community-leave-outbox";
import { persistExplicitCommunityMembershipLeave } from "./community-membership-coordinator";
import { addGroupTombstone } from "./group-tombstone-store";
import { shouldUseCoordinationMembershipAuthority } from "./community-workspace-r1-policy";
import { publishLeaveEventToRelay, type RelayPoolLike } from "./community-leave-outbox-retry";
import type { SealedCommunityNostrPool } from "./sealed-community-relay-scope";

export type PublishRelayConfirmedCommunityLeaveParams = Readonly<{
  pool: SealedCommunityNostrPool;
  groupId: string;
  relayUrl: string;
  communityId?: string;
  communityMode?: CommunityMode;
  myPublicKeyHex: PublicKeyHex;
  myPrivateKeyHex: PrivateKeyHex;
  initialMembers?: ReadonlyArray<PublicKeyHex>;
  leftMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
  expelledMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
}>;

/**
 * Network-confirmed leave only — no local ledger, tombstone, or sidebar mutation.
 * Returns true when relay/coordination evidence required for this community mode succeeds.
 */
export const publishRelayConfirmedCommunityLeave = async (
  params: PublishRelayConfirmedCommunityLeaveParams,
): Promise<boolean> => {
  const groupId = params.groupId.trim();
  const relayUrl = params.relayUrl.trim();
  if (!groupId || !relayUrl) {
    return false;
  }

  const profileId = getResolvedProfileId();
  const relayTransportReady = hasWritableCommunityRelayTransport(relayUrl);
  const relayAuthoritative = isRelayAuthoritativeMembershipEnforced();
  const requiresCoordinationLeave = shouldUseCoordinationMembershipAuthority(params.communityMode)
    && typeof params.communityId === "string"
    && params.communityId.trim().length > 0;

  if (relayAuthoritative && requiresCoordinationLeave) {
    const coordinationLeave = await publishCoordinationMembershipDelta({
      communityId: params.communityId!.trim(),
      action: "leave",
      subjectPubkey: params.myPublicKeyHex,
      actorPubkey: params.myPublicKeyHex,
      actorPrivateKeyHex: params.myPrivateKeyHex,
    });
    if (!coordinationLeave.success) {
      return false;
    }
  }

  if (relayAuthoritative && !relayTransportReady) {
    return !requiresCoordinationLeave ? false : true;
  }

  const groupService = new GroupService(params.myPublicKeyHex, params.myPrivateKeyHex);
  let nip29LeavePublished = false;

  try {
    const nip29Leave = await groupService.sendNip29Leave({ groupId });
    if (relayTransportReady) {
      const nip29Result = await publishLeaveEventToRelay({
        pool: params.pool as RelayPoolLike,
        relayUrl,
        event: nip29Leave,
      });
      nip29LeavePublished = nip29Result.success;
      recordCommunityLeaveRelayPublishOutcome({
        publicKeyHex: params.myPublicKeyHex,
        groupId,
        relayUrl,
        success: nip29Result.success,
        errorMessage: nip29Result.errorMessage,
        profileId,
      });
      if (relayAuthoritative && !nip29Result.success) {
        return false;
      }
    } else if (!relayAuthoritative) {
      nip29LeavePublished = false;
    }
  } catch {
    if (relayAuthoritative) {
      return false;
    }
  }

  try {
    const roomKeyHex = await roomKeyStore.getRoomKey(groupId);
    if (roomKeyHex && relayTransportReady) {
      const sealedLeave = await groupService.sendSealedLeave({ groupId, roomKeyHex });
      await publishLeaveEventToRelay({
        pool: params.pool as RelayPoolLike,
        relayUrl,
        event: sealedLeave,
      });

      const autoDisbandDecision = resolveCommunityAutoDisbandOnLeaveDecision({
        liveMemberPubkeys: params.initialMembers ?? [],
        seededMemberPubkeys: params.initialMembers,
        leftMemberPubkeys: params.leftMemberPubkeys ?? [],
        expelledMemberPubkeys: params.expelledMemberPubkeys ?? [],
        myPublicKeyHex: params.myPublicKeyHex,
      });
      if (autoDisbandDecision.shouldAttemptAutoDisband) {
        const disbandEvent = await groupService.sendSealedDisband({ groupId, roomKeyHex });
        await publishLeaveEventToRelay({
          pool: params.pool as RelayPoolLike,
          relayUrl,
          event: disbandEvent,
        });
      }
    }
  } catch {
    // Sealed leave / disband are best-effort after durable NIP-29 leave.
  }

  if (relayAuthoritative) {
    return nip29LeavePublished || (requiresCoordinationLeave && !relayTransportReady);
  }
  return nip29LeavePublished || !relayTransportReady;
};

/** Local commit only after {@link publishRelayConfirmedCommunityLeave} returns true. */
export const commitCommunityLeaveAfterRelayConfirmation = (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  group: GroupConversation;
  profileId?: string;
  tombstone?: boolean;
}>): void => {
  const groupId = params.group.groupId.trim();
  const relayUrl = params.group.relayUrl?.trim() ?? "";
  if (!groupId || !relayUrl) {
    return;
  }

  enqueueCommunityLeaveOutboxItem({
    publicKeyHex: params.publicKeyHex,
    groupId,
    relayUrl,
    communityId: params.group.communityId,
    profileId: params.profileId,
  });

  persistExplicitCommunityMembershipLeave({
    publicKeyHex: params.publicKeyHex,
    group: params.group,
    profileId: params.profileId,
    updatedAtUnixMs: Date.now(),
    relayConfirmed: true,
  });

  if (params.tombstone) {
    addGroupTombstone(params.publicKeyHex, { groupId, relayUrl }, { profileId: params.profileId });
  }
};
