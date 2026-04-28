export type CommunityRoomKeyState =
  | "missing"
  | "pending_distribution"
  | "active"
  | "superseded"
  | "revoked";

export type CommunitySendability = "sendable" | "blocked";

export type CommunitySendBlockReasonCode =
  | "membership_not_joined"
  | "community_not_visible"
  | "community_terminal"
  | "no_local_room_keys"
  | "target_room_key_missing_local_profile_scope"
  | "pending_distribution"
  | "active_epoch_missing"
  | "target_room_key_missing_after_membership_joined"
  | "target_room_key_record_unreadable"
  | "room_key_store_unavailable"
  | "relay_scope_unavailable";

export type CommunityRoomKeyRotationReason =
  | "community_created"
  | "member_removed"
  | "member_left_privacy_rotation"
  | "manual_security_rotation"
  | "compromise_suspected"
  | "protocol_reset";

export type CommunityRoomKeyProjection = Readonly<{
  communityId: string;
  keyEpoch: number | null;
  state: CommunityRoomKeyState;
  rotationReason?: CommunityRoomKeyRotationReason;
  sendability: CommunitySendability;
  sendBlockReasonCode?: CommunitySendBlockReasonCode;
  activatedAtUnixMs?: number;
  supersededAtUnixMs?: number;
}>;
