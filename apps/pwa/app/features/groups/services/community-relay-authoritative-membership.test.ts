import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isRelayAuthoritativeMembershipEnforced,
  relayMembershipRequiresRelayConfirmation,
} from "./community-relay-authoritative-membership-policy";
import { isRadicalMembershipTruthEnforced } from "./community-radical-truth-policy";
import { persistExplicitCommunityMembershipLeave } from "./community-membership-mutation-owner";
import type { GroupConversation } from "@/app/features/messaging/types";

const PUBLIC_KEY = "a".repeat(64);
const GROUP: GroupConversation = {
  kind: "group",
  id: "community:room:wss://relay.example",
  communityId: "room:wss://relay.example",
  groupId: "room",
  relayUrl: "wss://relay.example",
  displayName: "Room",
  memberPubkeys: [PUBLIC_KEY],
  lastMessage: "",
  unreadCount: 0,
  lastMessageTime: new Date(1_000),
  access: "invite-only",
  memberCount: 1,
  adminPubkeys: [],
};

describe("relay-authoritative membership policy", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubEnv("NEXT_PUBLIC_OBSCUR_RELAY_AUTHORITATIVE_MEMBERSHIP", "1");
    vi.stubEnv("NEXT_PUBLIC_OBSCUR_RADICAL_TRUTH", "0");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is enforced when explicit flag is set", () => {
    expect(isRelayAuthoritativeMembershipEnforced()).toBe(true);
    expect(isRadicalMembershipTruthEnforced()).toBe(true);
  });

  it("blocks local leave ledger writes without relay confirmation", () => {
    const mutation = persistExplicitCommunityMembershipLeave({
      publicKeyHex: PUBLIC_KEY,
      group: GROUP,
      profileId: "default",
    });
    expect(mutation).toBeNull();
  });

  it("allows local leave ledger writes after relay confirmation", () => {
    const mutation = persistExplicitCommunityMembershipLeave({
      publicKeyHex: PUBLIC_KEY,
      group: GROUP,
      profileId: "default",
      relayConfirmed: true,
    });
    expect(mutation).not.toBeNull();
    expect(mutation?.entry.status).toBe("left");
  });

  it("relayMembershipRequiresRelayConfirmation respects relayConfirmed", () => {
    expect(relayMembershipRequiresRelayConfirmation(undefined)).toBe(false);
    expect(relayMembershipRequiresRelayConfirmation(true)).toBe(true);
  });
});
