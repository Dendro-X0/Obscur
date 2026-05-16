import { beforeEach, describe, expect, it, vi } from "vitest";
import { createProfileMessageBus } from "@dweb/core/profile-message-bus";
import { setProfileRuntimeScope } from "@/app/features/profiles/services/profile-runtime-scope";
import { createCommunityMembership } from "./community-membership-crdt";
import {
  createMembershipRelayBridge,
  type RelayPool,
} from "./community-membership-relay-bridge";
import { MEMBERSHIP_GOSSIP_EVENT_KIND } from "./community-membership-gossip";

describe("community-membership-relay-bridge ingress", () => {
  const communityId = "community-1";
  const profileId = "default";
  const selfPubkey = "self-pubkey";
  const payload = btoa(JSON.stringify({ adds: [], removes: [], senderClock: {} }));

  beforeEach(() => {
    setProfileRuntimeScope(null);
  });

  it("publishes profile-scoped community-membership-ingress for accepted gossip", () => {
    const bus = createProfileMessageBus({ profileId });
    const busPublishSpy = vi.spyOn(bus, "publish");
    setProfileRuntimeScope({ profileId, bus });

    let membership = createCommunityMembership(communityId, "local-device");
    const setMembership = vi.fn((next) => {
      membership = next;
    });

    const subscriptions: Array<{
      filter: { kinds: number[]; "#e"?: string[]; since?: number };
      handler: (event: unknown) => void;
    }> = [];

    const relayPool: RelayPool = {
      publish: vi.fn(async () => {}),
      subscribe: (filter, handler) => {
        subscriptions.push({ filter, handler });
        return { unsubscribe: vi.fn() };
      },
      getConnectedCount: () => 1,
    };

    const bridge = createMembershipRelayBridge(
      communityId,
      "device-a",
      () => membership,
      setMembership,
      relayPool,
      {
        signEvent: vi.fn(async () => ({ id: "signed-id", sig: "signed-sig" })),
        getPublicKey: () => selfPubkey,
      },
    );

    bridge.start();

    const gossipSub = subscriptions.find((s) => s.filter.kinds.includes(MEMBERSHIP_GOSSIP_EVENT_KIND));
    expect(gossipSub).toBeTruthy();
    gossipSub?.handler({
      id: "evt-1",
      pubkey: "peer-pubkey",
      created_at: Math.floor(Date.now() / 1000),
      kind: MEMBERSHIP_GOSSIP_EVENT_KIND,
      tags: [["e", communityId], ["d", "peer-device"], ["k", "membership-gossip"]],
      content: payload,
      sig: "sig-1",
    });

    expect(busPublishSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: "community-membership-ingress",
      detail: expect.objectContaining({
        profileId,
        communityId,
        channel: "gossip",
        eventId: "evt-1",
        senderPubkey: "peer-pubkey",
        senderDeviceId: "peer-device",
        eventContent: payload,
      }),
    }));
    expect(setMembership).not.toHaveBeenCalled();

    bridge.stop();
  });

  it("rejects self-echo gossip and does not publish ingress event", () => {
    const bus = createProfileMessageBus({ profileId });
    const busPublishSpy = vi.spyOn(bus, "publish");
    setProfileRuntimeScope({ profileId, bus });

    let membership = createCommunityMembership(communityId, "local-device");
    const subscriptions: Array<{
      filter: { kinds: number[]; "#e"?: string[]; since?: number };
      handler: (event: unknown) => void;
    }> = [];

    const bridge = createMembershipRelayBridge(
      communityId,
      "device-a",
      () => membership,
      (next) => {
        membership = next;
      },
      {
        publish: vi.fn(async () => {}),
        subscribe: (filter, handler) => {
          subscriptions.push({ filter, handler });
          return { unsubscribe: vi.fn() };
        },
        getConnectedCount: () => 1,
      },
      {
        signEvent: vi.fn(async () => ({ id: "signed-id", sig: "signed-sig" })),
        getPublicKey: () => selfPubkey,
      },
    );

    bridge.start();

    const gossipSub = subscriptions.find((s) => s.filter.kinds.includes(MEMBERSHIP_GOSSIP_EVENT_KIND));
    gossipSub?.handler({
      id: "evt-self",
      pubkey: selfPubkey,
      created_at: Math.floor(Date.now() / 1000),
      kind: MEMBERSHIP_GOSSIP_EVENT_KIND,
      tags: [["e", communityId], ["d", "self-device"], ["k", "membership-gossip"]],
      content: payload,
      sig: "sig-self",
    });

    const ingressCalls = busPublishSpy.mock.calls.filter(
      (call) => (call[0] as { type?: string })?.type === "community-membership-ingress",
    );
    expect(ingressCalls).toHaveLength(0);

    bridge.stop();
  });
});

