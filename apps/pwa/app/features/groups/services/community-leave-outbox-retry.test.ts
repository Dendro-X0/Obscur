import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import { setProfileScopeOverride } from "@/app/features/profiles/services/profile-scope";

const GROUP_ID = "leave-retry-group";
const RELAY_URL = "wss://relay.retry.example";
const PUBLIC_KEY = "e".repeat(64) as PrivateKeyHex;
const PRIVATE_KEY = "f".repeat(64) as PrivateKeyHex;

const {
  publishViaRelayCoreMock,
  sendNip29LeaveMock,
  getRoomKeyMock,
} = vi.hoisted(() => ({
  publishViaRelayCoreMock: vi.fn(),
  sendNip29LeaveMock: vi.fn(),
  getRoomKeyMock: vi.fn(),
}));

vi.mock("@/app/features/relays/lib/nostr-core-relay", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/features/relays/lib/nostr-core-relay")>();
  return {
    ...actual,
    publishViaRelayCore: (...args: unknown[]) => publishViaRelayCoreMock(...args),
    getRelaySnapshot: () => ({
      atUnixMs: Date.now(),
      configuredRelayUrls: [RELAY_URL],
      writableRelayUrls: [RELAY_URL],
      totalRelayCount: 1,
      openRelayCount: 1,
    }),
  };
});

vi.mock("./group-service", () => ({
  GroupService: class MockGroupService {
    sendNip29Leave = sendNip29LeaveMock;

    sendSealedLeave = vi.fn(async () => ({ id: "sealed-leave" }));
  },
}));

vi.mock("@/app/features/crypto/room-key-store", () => ({
  roomKeyStore: {
    getRoomKey: (...args: unknown[]) => getRoomKeyMock(...args),
  },
}));

import {
  enqueueCommunityLeaveOutboxItem,
  getPendingCommunityLeaveOutboxItems,
  readCommunityLeaveOutbox,
} from "./community-leave-outbox";
import { flushPendingCommunityLeaveOutbox } from "./community-leave-outbox-retry";

const createPool = () => ({
  connections: [{ url: RELAY_URL, status: "open" }],
  waitForConnection: vi.fn(async () => true),
  publishToUrls: vi.fn(),
});

describe("flushPendingCommunityLeaveOutbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    setProfileScopeOverride(null);
    sendNip29LeaveMock.mockResolvedValue({ id: "nip29-leave" });
    getRoomKeyMock.mockResolvedValue(null);
    publishViaRelayCoreMock.mockResolvedValue({ status: "ok" });
  });

  it("publishes pending leave and clears outbox on success", async () => {
    enqueueCommunityLeaveOutboxItem({
      publicKeyHex: PUBLIC_KEY,
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
    });

    const result = await flushPendingCommunityLeaveOutbox({
      publicKeyHex: PUBLIC_KEY,
      privateKeyHex: PRIVATE_KEY,
      pool: createPool(),
    });

    expect(result).toEqual({
      attempted: 1,
      published: 1,
      failed: 0,
      skippedNoWritableRelay: false,
    });
    expect(sendNip29LeaveMock).toHaveBeenCalledWith({ groupId: GROUP_ID });
    expect(publishViaRelayCoreMock).toHaveBeenCalled();
    expect(getPendingCommunityLeaveOutboxItems(PUBLIC_KEY)).toHaveLength(0);
  });

  it("records rate_limited outbox when relay publish fails", async () => {
    enqueueCommunityLeaveOutboxItem({
      publicKeyHex: PUBLIC_KEY,
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
    });
    publishViaRelayCoreMock.mockResolvedValue({
      status: "failed",
      message: "HTTP 429 rate limit",
      reasonCode: "quorum_not_met",
    });

    const result = await flushPendingCommunityLeaveOutbox({
      publicKeyHex: PUBLIC_KEY,
      privateKeyHex: PRIVATE_KEY,
      pool: createPool(),
    });

    expect(result.attempted).toBe(1);
    expect(result.published).toBe(0);
    expect(result.failed).toBe(1);
    const items = readCommunityLeaveOutbox(PUBLIC_KEY);
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe("rate_limited");
  });

  it("coalesces concurrent flush calls for the same profile scope", async () => {
    enqueueCommunityLeaveOutboxItem({
      publicKeyHex: PUBLIC_KEY,
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
    });

    let publishCallCount = 0;
    publishViaRelayCoreMock.mockImplementation(async () => {
      publishCallCount += 1;
      await new Promise((resolve) => { setTimeout(resolve, 25); });
      return { status: "ok" };
    });

    const pool = createPool();
    const [a, b] = await Promise.all([
      flushPendingCommunityLeaveOutbox({
        publicKeyHex: PUBLIC_KEY,
        privateKeyHex: PRIVATE_KEY,
        pool,
      }),
      flushPendingCommunityLeaveOutbox({
        publicKeyHex: PUBLIC_KEY,
        privateKeyHex: PRIVATE_KEY,
        pool,
      }),
    ]);

    expect(a).toEqual(b);
    expect(publishCallCount).toBe(1);
  });
});
