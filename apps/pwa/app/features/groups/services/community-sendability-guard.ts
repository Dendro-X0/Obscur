import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { GroupMembershipStatus } from "../types";

export type CommunitySendabilityStatus = Readonly<{
  canSend: boolean;
  reasonCode:
    | "ready"
    | "no_membership"
    | "no_room_key"
    | "stale_room_key"
    | "expelled"
    | "left"
    | "pending_join";
  reasonMessage: string;
  debugContext?: Readonly<{
    groupId: string;
    hasMembership: boolean;
    membershipStatus: GroupMembershipStatus;
    hasRoomKey: boolean;
    roomKeyEpochMs?: number;
    roomKeyAgeMs?: number;
  }>;
}>;

export type CommunitySendabilityCheckParams = Readonly<{
  groupId: string;
  localMemberPubkey: PublicKeyHex | null;
  membershipStatus: GroupMembershipStatus;
  hasRoomKey: boolean;
  roomKeyEpochMs?: number;
  expelledPubkeys?: ReadonlySet<PublicKeyHex>;
  leftPubkeys?: ReadonlySet<PublicKeyHex>;
}>;

const ROOM_KEY_STALE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export const checkCommunitySendability = (
  params: CommunitySendabilityCheckParams
): CommunitySendabilityStatus => {
  const hasMembership = params.membershipStatus === "member";
  const isPending = params.membershipStatus === "unknown";
  const isExpelled = params.localMemberPubkey
    ? params.expelledPubkeys?.has(params.localMemberPubkey) ?? false
    : false;
  const hasLeft = params.localMemberPubkey
    ? params.leftPubkeys?.has(params.localMemberPubkey) ?? false
    : false;

  const roomKeyAgeMs = params.roomKeyEpochMs
    ? Date.now() - params.roomKeyEpochMs
    : undefined;
  const isRoomKeyStale = roomKeyAgeMs
    ? roomKeyAgeMs > ROOM_KEY_STALE_THRESHOLD_MS
    : false;

  const debugContext = {
    groupId: params.groupId,
    hasMembership,
    membershipStatus: params.membershipStatus,
    hasRoomKey: params.hasRoomKey,
    roomKeyEpochMs: params.roomKeyEpochMs,
    roomKeyAgeMs,
  };

  // Priority: expulsion and leaving block first
  if (isExpelled) {
    return {
      canSend: false,
      reasonCode: "expelled",
      reasonMessage: "Cannot send: you have been removed from this community.",
      debugContext,
    };
  }

  if (hasLeft) {
    return {
      canSend: false,
      reasonCode: "left",
      reasonMessage: "Cannot send: you have left this community.",
      debugContext,
    };
  }

  // Membership check
  if (!hasMembership) {
    if (isPending) {
      return {
        canSend: false,
        reasonCode: "pending_join",
        reasonMessage: "Cannot send: waiting for community join confirmation.",
        debugContext,
      };
    }
    return {
      canSend: false,
      reasonCode: "no_membership",
      reasonMessage: "Cannot send: you are not a member of this community.",
      debugContext,
    };
  }

  // Room key check
  if (!params.hasRoomKey) {
    return {
      canSend: false,
      reasonCode: "no_room_key",
      reasonMessage: "Cannot send: no room key available. Request a key from another member.",
      debugContext,
    };
  }

  if (isRoomKeyStale) {
    return {
      canSend: false,
      reasonCode: "stale_room_key",
      reasonMessage: "Cannot send: room key may be outdated. Request a fresh key from another member.",
      debugContext,
    };
  }

  return {
    canSend: true,
    reasonCode: "ready",
    reasonMessage: "Ready to send.",
    debugContext,
  };
};

export const formatSendabilityForComposer = (
  status: CommunitySendabilityStatus
): { disabled: boolean; placeholder: string } => {
  if (status.canSend) {
    return { disabled: false, placeholder: "Type a message..." };
  }
  return {
    disabled: true,
    placeholder: status.reasonMessage,
  };
};
