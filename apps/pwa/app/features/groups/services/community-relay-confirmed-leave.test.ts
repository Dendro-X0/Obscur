import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { setProfileScopeOverride } from "@/app/features/profiles/services/profile-scope";
import type { GroupConversation } from "@/app/features/messaging/types";

const GROUP_ID = "relay-leave-group";
const RELAY_URL = "wss://relay.leave.example";
const PUBLIC_KEY = "e".repeat(64) as PublicKeyHex;
const PRIVATE_KEY = "f".repeat(64) as PrivateKeyHex;

const {
  publishLeaveEventToRelayMock,
  sendNip29LeaveMock,
  getRoomKeyMock,
  publishCoordinationMembershipDeltaMock,
} = vi.hoisted(() => ({
  publishLeaveEventToRelayMock: vi.fn(),
  sendNip29LeaveMock: vi.fn(),
  getRoomKeyMock: vi.fn(),
  publishCoordinationMembershipDeltaMock: vi.fn(),
}));

vi.mock("./community-leave-outbox-retry", () => ({
  publishLeaveEventToRelay: (...args: unknown[]) => publishLeaveEventToRelayMock(...args),
}));

vi.mock("./group-service", () => ({
  GroupService: class MockGroupService {
    sendNip29Leave = sendNip29LeaveMock;
    sendSealedLeave = vi.fn(async () => ({ id: "sealed-leave" }));
    sendSealedDisband = vi.fn(async () => ({ id: "sealed-disband" }));
  },
}));

vi.mock("@/app/features/crypto/room-key-store", () => ({
  roomKeyStore: {
    getRoomKey: (...args: unknown[]) => getRoomKeyMock(...args),
  },
}));

vi.mock("./community-coordination-membership-client", () => ({
  publishCoordinationMembershipDelta: (...args: unknown[]) => publishCoordinationMembershipDeltaMock(...args),
}));

vi.mock("@/app/features/relays/lib/nostr-core-relay", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/features/relays/lib/nostr-core-relay")>();
  return {
    ...actual,
    getRelaySnapshot: () => ({
      atUnixMs: Date.now(),
      configuredRelayUrls: [RELAY_URL],
      writableRelayUrls: [RELAY_URL],
      totalRelayCount: 1,
      openRelayCount: 1,
    }),
  };
});

import {
  commitCommunityLeaveAfterRelayConfirmation,
  publishRelayConfirmedCommunityLeave,
} from "./community-relay-confirmed-leave";
import { loadCommunityMembershipLedger } from "./community-membership-ledger";
import { getPendingCommunityLeaveOutboxItems } from "./community-leave-outbox";

const GROUP: GroupConversation = {
  kind: "group",
  id: `community:${GROUP_ID}:${RELAY_URL}`,
  communityId: `${GROUP_ID}:${RELAY_URL}`,
  groupId: GROUP_ID,
  relayUrl: RELAY_URL,
  displayName: "Relay Leave Group",
  memberPubkeys: [PUBLIC_KEY],
  lastMessage: "",
  unreadCount: 0,
  lastMessageTime: new Date(1_000),
  access: "invite-only",
  memberCount: 1,
  adminPubkeys: [],
};

const createPool = () => ({
  connections: [{ url: RELAY_URL, status: "open" }],
  waitForConnection: vi.fn(async () => true),
  publishToUrls: vi.fn(),
});

describe("community-relay-confirmed-leave", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    setProfileScopeOverride(null);
    vi.stubEnv("NEXT_PUBLIC_OBSCUR_RELAY_AUTHORITATIVE_MEMBERSHIP", "1");
    sendNip29LeaveMock.mockResolvedValue({ id: "nip29-leave" });
    getRoomKeyMock.mockResolvedValue(null);
    publishCoordinationMembershipDeltaMock.mockResolvedValue({ success: true });
  });

  it("publishRelayConfirmedCommunityLeave returns false when relay publish fails", async () => {
    publishLeaveEventToRelayMock.mockResolvedValue({ success: false, errorMessage: "rejected" });

    const confirmed = await publishRelayConfirmedCommunityLeave({
      pool: createPool() as never,
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      myPublicKeyHex: PUBLIC_KEY,
      myPrivateKeyHex: PRIVATE_KEY,
    });

    expect(confirmed).toBe(false);
    expect(getPendingCommunityLeaveOutboxItems(PUBLIC_KEY)).toHaveLength(0);
    expect(loadCommunityMembershipLedger(PUBLIC_KEY)).toHaveLength(0);
  });

  it("publishRelayConfirmedCommunityLeave returns true when relay publish succeeds", async () => {
    publishLeaveEventToRelayMock.mockResolvedValue({ success: true });

    const confirmed = await publishRelayConfirmedCommunityLeave({
      pool: createPool() as never,
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      myPublicKeyHex: PUBLIC_KEY,
      myPrivateKeyHex: PRIVATE_KEY,
    });

    expect(confirmed).toBe(true);
    expect(getPendingCommunityLeaveOutboxItems(PUBLIC_KEY)).toHaveLength(0);
    expect(loadCommunityMembershipLedger(PUBLIC_KEY)).toHaveLength(0);
  });

  it("commitCommunityLeaveAfterRelayConfirmation writes ledger and outbox only after relay success", () => {
    commitCommunityLeaveAfterRelayConfirmation({
      publicKeyHex: PUBLIC_KEY,
      group: GROUP,
    });

    expect(getPendingCommunityLeaveOutboxItems(PUBLIC_KEY)).toHaveLength(1);
    expect(loadCommunityMembershipLedger(PUBLIC_KEY).some((entry) => entry.status === "left")).toBe(true);
  });
});
