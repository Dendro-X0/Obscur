import { describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { createProfileMessageBus } from "@dweb/core/profile-message-bus";
import type { GroupConversation } from "@/app/features/messaging/types";
import { setProfileScopeOverride } from "@/app/features/profiles/services/profile-scope";
import { bindCommunityMembershipIngressApply } from "./bind-community-membership-ingress-apply";
import { loadCommunityTerminalMembershipCache } from "./community-terminal-membership-cache";

const LOCAL = "a".repeat(64) as PublicKeyHex;
const PEER = "b".repeat(64) as PublicKeyHex;

const GROUP: GroupConversation = {
  kind: "group",
  id: "conv-1",
  groupId: "grp-leave",
  relayUrl: "wss://relay.leave",
  communityId: "comm-leave",
  displayName: "Leave",
  memberPubkeys: [LOCAL, PEER],
  lastMessage: "",
  unreadCount: 0,
  lastMessageTime: new Date(0),
  access: "invite-only",
  memberCount: 2,
  adminPubkeys: [],
};

const encodeGossipPayload = (params: Readonly<{
  adds?: ReadonlyArray<string>;
  removes?: ReadonlyArray<string>;
}>): string => (
  Buffer.from(JSON.stringify({
    adds: (params.adds ?? []).map((pubkey) => ({ pubkey, deviceId: "device-a", clock: {} })),
    removes: (params.removes ?? []).map((pubkey) => ({ pubkey, deviceId: "device-a", clock: {} })),
    sinceClock: {},
    senderClock: {},
  })).toString("base64")
);

describe("bindCommunityMembershipIngressApply", () => {
  it("marks peer left sticky and shrinks roster on gossip remove", () => {
    window.localStorage.clear();
    setProfileScopeOverride(null);
    const bus = createProfileMessageBus({ profileId: "default" });
    const updateGroupMembers = vi.fn();
    const applyLocalLeaveFromRelay = vi.fn();

    const unbind = bindCommunityMembershipIngressApply({
      profileBus: bus,
      localPublicKeyHex: LOCAL,
      resolveGroupByCommunityId: () => GROUP,
      updateGroupMembers,
      applyLocalJoinFromRelay: vi.fn(),
      applyLocalLeaveFromRelay,
    });

    bus.publish({
      type: "community-membership-ingress",
      detail: {
        profileId: "default",
        communityId: "comm-leave",
        channel: "gossip",
        eventId: "evt-leave",
        senderPubkey: PEER,
        senderDeviceId: "device-b",
        receivedAtUnixMs: 4_000,
        eventContent: encodeGossipPayload({ removes: [PEER] }),
      },
    });

    expect(updateGroupMembers).toHaveBeenCalledWith({
      group: GROUP,
      memberPubkeys: [LOCAL],
    });
    expect(applyLocalLeaveFromRelay).not.toHaveBeenCalled();
    expect(loadCommunityTerminalMembershipCache({
      groupId: GROUP.groupId,
      relayUrl: GROUP.relayUrl,
    })?.leftMemberPubkeys).toEqual([PEER]);

    unbind();
  });
});
