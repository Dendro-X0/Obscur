import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";

const memberPubkey = "bb".repeat(32) as PublicKeyHex;
const actorPrivateKeyHex = "cc".repeat(32) as PrivateKeyHex;

const persistLedger = vi.fn();
const refreshDirectory = vi.fn(async () => null);
const runActivation = vi.fn();
const getRoomKey = vi.fn(async () => null as string | null);
const saveRoomKey = vi.fn(async () => undefined);
const deleteRoomKey = vi.fn(async () => undefined);
const upsertMetadata = vi.fn();
const publishSelfRoomKeyWrap = vi.fn(async () => ({ ok: true as const, wrapSeq: 1 }));

vi.mock("@/app/features/runtime/native-persistence-policy", () => ({
  requiresSqlitePersistence: vi.fn(() => true),
}));

vi.mock("@/app/features/groups/services/community-membership-sync-mode", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/features/groups/services/community-membership-sync-mode")>();
  return {
    ...actual,
    isCoordinationConfigured: vi.fn(() => true),
    getCoordinationBaseUrl: vi.fn(() => "http://127.0.0.1:8787"),
  };
});

vi.mock("@/app/features/workspace-kernel/workspace-kernel-policy", () => ({
  isWorkspaceKernelAuthority: vi.fn(() => true),
}));

vi.mock("@/app/features/groups/services/community-membership-mutation-owner", () => ({
  persistCommunityMembershipLedgerMutation: vi.fn(persistLedger),
}));

vi.mock("@/app/features/groups/services/community-coordination-membership-directory-store", () => ({
  loadCoordinationMembershipDirectory: vi.fn(() => null),
  refreshCoordinationMembershipDirectory: vi.fn(refreshDirectory),
}));

vi.mock("@/app/features/groups/services/community-workspace-activation", () => ({
  runWorkspaceMembershipActivation: vi.fn(runActivation),
}));

vi.mock("@/app/features/crypto/room-key-store", () => ({
  roomKeyStore: {
    getRoomKey: vi.fn(getRoomKey),
    saveRoomKey: vi.fn(saveRoomKey),
    deleteRoomKey: vi.fn(deleteRoomKey),
  },
}));

vi.mock("./workspace-kernel-group-metadata-cache", () => ({
  upsertWorkspaceGroupMetadata: vi.fn(upsertMetadata),
}));

vi.mock("@/app/features/groups/services/community-relay-authoritative-membership-policy", () => ({
  isRelayAuthoritativeMembershipEnforced: vi.fn(() => false),
}));

vi.mock("@/app/features/groups/services/community-workspace-membership", () => ({
  ensureWorkspaceMembershipSyncMode: vi.fn(),
}));

vi.mock("@/app/features/groups/services/community-coordination-room-key-owner", () => ({
  publishSelfCoordinationRoomKeyWrapAfterJoin: vi.fn(publishSelfRoomKeyWrap),
}));

vi.mock("@/app/features/groups/services/community-dev-flags", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/features/groups/services/community-dev-flags")>();
  return {
    ...actual,
    isCoordinationOnlyWorkspaceDevMode: vi.fn(() => false),
  };
});

describe("joinManagedWorkspaceMembership atomic join (R1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRoomKey.mockResolvedValue(null);
    refreshDirectory.mockResolvedValue({
      activeMemberPubkeys: [],
      leftMemberPubkeys: [],
      expelledMemberPubkeys: [],
      headSeq: 1,
    });
    runActivation.mockResolvedValue({
      relay: { status: "failed", canonicalUrl: "ws://localhost:7000", publishTargets: [] },
      coordination: { status: "failed", lastError: "coordination_failed" },
      summary: {
        severity: "failed",
        title: "Join failed",
        detail: "Coordination did not confirm join.",
        recovery: ["retry_join"],
      },
    });
  });

  it("J-5: fails without room key and does not persist ledger", async () => {
    const { joinManagedWorkspaceMembership } = await import("./workspace-kernel-membership-port");
    const result = await joinManagedWorkspaceMembership({
      communityId: "room:ws://localhost:7000",
      groupId: "room",
      relayUrl: "ws://localhost:7000",
      memberPubkey,
      actorPubkey: memberPubkey,
      actorPrivateKeyHex,
      pool: {} as never,
      addRelay: vi.fn(),
    });
    expect(result.ok).toBe(false);
    expect(persistLedger).not.toHaveBeenCalled();
    expect(runActivation).not.toHaveBeenCalled();
  });

  it("J-6: rolls back room key when coordination fails after save", async () => {
    getRoomKey.mockResolvedValue(null);
    saveRoomKey.mockImplementation(async () => {
      getRoomKey.mockResolvedValue("ff".repeat(32));
    });
    const { joinManagedWorkspaceMembership } = await import("./workspace-kernel-membership-port");
    const result = await joinManagedWorkspaceMembership({
      communityId: "room:ws://localhost:7000",
      groupId: "room",
      relayUrl: "ws://localhost:7000",
      memberPubkey,
      actorPubkey: memberPubkey,
      actorPrivateKeyHex,
      pool: {} as never,
      addRelay: vi.fn(),
      roomKeyHex: "ff".repeat(32),
    });
    expect(result.ok).toBe(false);
    expect(saveRoomKey).toHaveBeenCalled();
    expect(deleteRoomKey).toHaveBeenCalledWith("room");
    expect(persistLedger).not.toHaveBeenCalled();
  });

  it("persists ledger only after successful join predicates", async () => {
    getRoomKey.mockResolvedValue("ff".repeat(32));
    runActivation.mockResolvedValue({
      relay: { status: "synced", canonicalUrl: "ws://localhost:7000", publishTargets: ["ws://localhost:7000"] },
      coordination: { status: "synced" },
      summary: {
        severity: "success",
        title: "Joined",
        recovery: [],
      },
    });
    refreshDirectory.mockResolvedValue({
      activeMemberPubkeys: [memberPubkey],
      leftMemberPubkeys: [],
      expelledMemberPubkeys: [],
      headSeq: 1,
    });
    const { joinManagedWorkspaceMembership } = await import("./workspace-kernel-membership-port");
    const result = await joinManagedWorkspaceMembership({
      communityId: "room:ws://localhost:7000",
      groupId: "room",
      relayUrl: "ws://localhost:7000",
      memberPubkey,
      actorPubkey: memberPubkey,
      actorPrivateKeyHex,
      pool: {} as never,
      addRelay: vi.fn(),
      roomKeyHex: "ff".repeat(32),
    });
    expect(result.ok).toBe(true);
    expect(persistLedger).toHaveBeenCalledTimes(1);
    expect(deleteRoomKey).not.toHaveBeenCalled();
    expect(publishSelfRoomKeyWrap).toHaveBeenCalledWith({
      communityId: "room:ws://localhost:7000",
      groupId: "room",
      memberPubkey,
      actorPubkey: memberPubkey,
      actorPrivateKeyHex,
      roomKeyHex: "ff".repeat(32),
    });
  });

  it("does not publish room key wrap when coordination join did not sync", async () => {
    getRoomKey.mockResolvedValue("ff".repeat(32));
    runActivation.mockResolvedValue({
      relay: { status: "synced", canonicalUrl: "ws://localhost:7000", publishTargets: ["ws://localhost:7000"] },
      coordination: { status: "failed", lastError: "coordination_failed" },
      summary: {
        severity: "failed",
        title: "Join failed",
        detail: "Coordination did not confirm join.",
        recovery: ["retry_join"],
      },
    });
    refreshDirectory.mockResolvedValue({
      activeMemberPubkeys: [],
      leftMemberPubkeys: [],
      expelledMemberPubkeys: [],
      headSeq: 0,
    });
    const { joinManagedWorkspaceMembership } = await import("./workspace-kernel-membership-port");
    const result = await joinManagedWorkspaceMembership({
      communityId: "room:ws://localhost:7000",
      groupId: "room",
      relayUrl: "ws://localhost:7000",
      memberPubkey,
      actorPubkey: memberPubkey,
      actorPrivateKeyHex,
      pool: {} as never,
      addRelay: vi.fn(),
      roomKeyHex: "ff".repeat(32),
    });
    expect(result.ok).toBe(false);
    expect(publishSelfRoomKeyWrap).not.toHaveBeenCalled();
  });
});
