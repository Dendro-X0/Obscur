import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { CommunityMode, RelayCapabilityTier } from "./community-mode";

export type GroupRole = "member" | "guest";

export type GroupAccessMode = "open" | "invite-only" | "discoverable";

export type GroupMembershipStatus = "unknown" | "member" | "none" | "not_member";
export type JoinRequestState = "none" | "pending" | "accepted" | "denied" | "expired" | "cooldown";
export type { CommunityMode, RelayCapabilityTier } from "./community-mode";

export interface GroupMetadata {
    id: string;
    name: string;
    about?: string;
    picture?: string;
    access: GroupAccessMode;
    memberCount?: number;
    communityMode?: CommunityMode;
    relayCapabilityTier?: RelayCapabilityTier;
}
