import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveMembershipIngressVerdict } from "./community-membership-ingress";

vi.mock("@/app/shared/log-app-event", () => ({
  logAppEvent: vi.fn(),
}));

const SELF = "self_pubkey";
const OTHER = "other_pubkey";
const COMMUNITY = "community-1";

const makeEvent = (tags: string[][]) => ({
  id: "event-1",
  pubkey: OTHER,
  tags,
});

describe("community-membership-ingress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts gossip ingress with matching community tag", () => {
    const verdict = resolveMembershipIngressVerdict({
      event: makeEvent([["e", COMMUNITY], ["d", "dev-a"]]),
      expectedCommunityId: COMMUNITY,
      selfPubkey: SELF,
    });
    expect(verdict).toEqual({
      accepted: true,
      channel: "gossip",
      senderDeviceId: "dev-a",
      communityId: COMMUNITY,
    });
  });

  it("rejects self-echo events", () => {
    const verdict = resolveMembershipIngressVerdict({
      event: {
        id: "event-2",
        pubkey: SELF,
        tags: [["e", COMMUNITY]],
      },
      expectedCommunityId: COMMUNITY,
      selfPubkey: SELF,
    });
    expect(verdict).toEqual({
      accepted: false,
      reason: "self_echo",
    });
  });

  it("classifies anti-entropy response and enforces recipient p-tag", () => {
    const accepted = resolveMembershipIngressVerdict({
      event: makeEvent([
        ["e", COMMUNITY],
        ["k", "anti-entropy-response"],
        ["p", SELF],
        ["d", "dev-b"],
      ]),
      expectedCommunityId: COMMUNITY,
      selfPubkey: SELF,
    });
    expect(accepted).toEqual({
      accepted: true,
      channel: "anti_entropy_response",
      senderDeviceId: "dev-b",
      communityId: COMMUNITY,
    });

    const rejected = resolveMembershipIngressVerdict({
      event: makeEvent([
        ["e", COMMUNITY],
        ["k", "anti-entropy-response"],
        ["p", "another-user"],
      ]),
      expectedCommunityId: COMMUNITY,
      selfPubkey: SELF,
    });
    expect(rejected).toEqual({
      accepted: false,
      reason: "anti_entropy_not_addressed_to_self",
    });
  });
});

