import { describe, expect, it, vi } from "vitest";
import type { GroupConversation } from "@/app/features/messaging/types";
import { applyCommunityMembershipIngress } from "./apply-community-membership-ingress";

const GROUP: GroupConversation = {
  kind: "group",
  id: "conv-1",
  groupId: "grp-1",
  relayUrl: "wss://relay.example",
  communityId: "comm-1",
  displayName: "Test",
  memberPubkeys: [],
  lastMessage: "",
  unreadCount: 0,
  lastMessageTime: new Date(0),
  access: "invite-only",
  memberCount: 1,
  adminPubkeys: [],
};

const encodeGossipPayload = (params: Readonly<{
  adds: ReadonlyArray<string>;
  removes?: ReadonlyArray<string>;
}>): string => (
  Buffer.from(JSON.stringify({
    adds: params.adds.map((pubkey) => ({ pubkey, deviceId: "device-a", clock: {} })),
    removes: (params.removes ?? []).map((pubkey) => ({ pubkey, deviceId: "device-a", clock: {} })),
    sinceClock: {},
    senderClock: {},
  })).toString("base64")
);

describe("applyCommunityMembershipIngress", () => {
  it("widens roster and applies local join when gossip adds local pubkey", () => {
    const widenRoster = vi.fn();
    const applyLocalJoinFromRelay = vi.fn();
    const applyLocalLeaveFromRelay = vi.fn();

    applyCommunityMembershipIngress({
      detail: {
        profileId: "p1",
        communityId: "comm-1",
        channel: "gossip",
        eventId: "evt-1",
        senderPubkey: "sender",
        senderDeviceId: "device-a",
        receivedAtUnixMs: 1_000,
        eventContent: encodeGossipPayload({ adds: ["local-pk", "peer-pk"], removes: [] }),
      },
      localPublicKeyHex: "local-pk",
      resolveGroup: () => GROUP,
      widenRoster,
      applyLocalJoinFromRelay,
      applyLocalLeaveFromRelay,
    });

    expect(widenRoster).toHaveBeenCalledWith({
      group: GROUP,
      memberPubkeys: ["local-pk", "peer-pk"],
    });
    expect(applyLocalJoinFromRelay).toHaveBeenCalledWith(GROUP);
    expect(applyLocalLeaveFromRelay).not.toHaveBeenCalled();
  });

  it("applies local leave when gossip removes local pubkey", () => {
    const applyLocalLeaveFromRelay = vi.fn();

    applyCommunityMembershipIngress({
      detail: {
        profileId: "p1",
        communityId: "comm-1",
        channel: "gossip",
        eventId: "evt-2",
        senderPubkey: "sender",
        senderDeviceId: "device-a",
        receivedAtUnixMs: 2_000,
        eventContent: encodeGossipPayload({ adds: [], removes: ["local-pk"] }),
      },
      localPublicKeyHex: "local-pk",
      resolveGroup: () => GROUP,
      widenRoster: vi.fn(),
      applyLocalJoinFromRelay: vi.fn(),
      applyLocalLeaveFromRelay,
    });

    expect(applyLocalLeaveFromRelay).toHaveBeenCalledWith(GROUP);
  });
});
