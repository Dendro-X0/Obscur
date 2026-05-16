import type { MembershipIngressChannel } from "./community-membership-ingress";

/** Profile-bus payload for `community-membership-ingress` (Phase 3 M1). */
export type CommunityMembershipIngressDetail = Readonly<{
  profileId: string;
  communityId: string;
  channel: MembershipIngressChannel;
  eventId: string;
  senderPubkey: string;
  senderDeviceId: string;
  receivedAtUnixMs: number;
  /** Base64 gossip payload when `channel === "gossip"`. */
  eventContent?: string;
}>;

export const isCommunityMembershipIngressDetail = (
  value: unknown,
): value is CommunityMembershipIngressDetail => {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.profileId === "string"
    && typeof record.communityId === "string"
    && typeof record.channel === "string"
    && typeof record.eventId === "string"
    && typeof record.senderPubkey === "string"
    && typeof record.senderDeviceId === "string"
    && typeof record.receivedAtUnixMs === "number"
  );
};
