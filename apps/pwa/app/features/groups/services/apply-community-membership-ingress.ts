import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { GroupConversation } from "@/app/features/messaging/types";
import { logAppEvent } from "@/app/shared/log-app-event";
import { decodeMembershipDelta } from "./community-membership-gossip";
import type { CommunityMembershipIngressDetail } from "./community-membership-ingress-contract";

export type ApplyCommunityMembershipIngressParams = Readonly<{
  detail: CommunityMembershipIngressDetail;
  localPublicKeyHex: PublicKeyHex | null;
  resolveGroup: (communityId: string) => GroupConversation | undefined;
  widenRoster: (params: Readonly<{
    group: GroupConversation;
    memberPubkeys: ReadonlyArray<PublicKeyHex>;
  }>) => void;
  applyLocalJoinFromRelay: (group: GroupConversation) => void;
  applyLocalLeaveFromRelay: (group: GroupConversation) => void;
}>;

const normalizePubkeys = (values: ReadonlyArray<string>): ReadonlyArray<PublicKeyHex> => (
  values
    .map((value) => value.trim())
    .filter((value) => value.length > 0) as ReadonlyArray<PublicKeyHex>
);

/**
 * Phase 3 M1/M2 — apply relay ingress at the coordinator boundary (roster + local join/leave only).
 */
export const applyCommunityMembershipIngress = (params: ApplyCommunityMembershipIngressParams): void => {
  const { detail, localPublicKeyHex } = params;
  const group = params.resolveGroup(detail.communityId);
  if (!group) {
    logAppEvent({
      name: "groups.membership_ingress_applied",
      level: "debug",
      scope: { feature: "groups", action: "membership_ingress" },
      context: {
        result: "no_matching_group",
        channel: detail.channel,
        communityIdHint: detail.communityId.slice(0, 48),
        eventIdHint: detail.eventId.slice(0, 16),
      },
    });
    return;
  }

  if (detail.channel !== "gossip" || !detail.eventContent?.trim()) {
    logAppEvent({
      name: "groups.membership_ingress_applied",
      level: "debug",
      scope: { feature: "groups", action: "membership_ingress" },
      context: {
        result: "observed_non_gossip",
        channel: detail.channel,
        communityIdHint: detail.communityId.slice(0, 48),
        eventIdHint: detail.eventId.slice(0, 16),
      },
    });
    return;
  }

  let adds: ReadonlyArray<string> = [];
  let removes: ReadonlyArray<string> = [];
  try {
    const delta = decodeMembershipDelta({
      communityId: detail.communityId,
      senderDeviceId: detail.senderDeviceId,
      vectorClock: {},
      payload: detail.eventContent,
      timestamp: detail.receivedAtUnixMs,
    });
    adds = (delta.adds ?? []).map((entry) => entry.pubkey);
    removes = (delta.removes ?? []).map((entry) => entry.pubkey);
  } catch (error) {
    logAppEvent({
      name: "groups.membership_ingress_applied",
      level: "warn",
      scope: { feature: "groups", action: "membership_ingress" },
      context: {
        result: "decode_failed",
        communityIdHint: detail.communityId.slice(0, 48),
        eventIdHint: detail.eventId.slice(0, 16),
        error: error instanceof Error ? error.message : "unknown",
      },
    });
    return;
  }

  const addPubkeys = normalizePubkeys(adds);
  const removePubkeys = normalizePubkeys(removes);
  if (addPubkeys.length > 0) {
    params.widenRoster({ group, memberPubkeys: addPubkeys });
  }

  const localKey = localPublicKeyHex?.trim() ?? "";
  if (localKey.length > 0) {
    if (addPubkeys.includes(localKey)) {
      params.applyLocalJoinFromRelay(group);
    }
    if (removePubkeys.includes(localKey)) {
      params.applyLocalLeaveFromRelay(group);
    }
  }

  logAppEvent({
    name: "groups.membership_ingress_applied",
    level: "info",
    scope: { feature: "groups", action: "membership_ingress" },
    context: {
      result: "gossip_applied",
      communityIdHint: detail.communityId.slice(0, 48),
      eventIdHint: detail.eventId.slice(0, 16),
      addCount: addPubkeys.length,
      removeCount: removePubkeys.length,
      localJoined: localKey.length > 0 && addPubkeys.includes(localKey),
      localRemoved: localKey.length > 0 && removePubkeys.includes(localKey),
    },
  });
};
