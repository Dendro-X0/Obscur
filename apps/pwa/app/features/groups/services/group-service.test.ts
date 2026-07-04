import { describe, expect, it, vi, beforeEach } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import { GroupService } from "./group-service";
import { roomKeyStore } from "../../crypto/room-key-store";
import { logAppEvent } from "@/app/shared/log-app-event";
import { loadCommunityMembershipLedger } from "./community-membership-ledger";
import { resolveRoomKeyForCommunityAction } from "./community-coordination-room-key-owner";
import { loadCoordinationMembershipDirectory } from "./community-coordination-membership-directory-store";
import { cryptoService } from "../../crypto/crypto-service";

vi.mock("../../crypto/room-key-store", () => ({
  roomKeyStore: {
    getRoomKeyRecord: vi.fn(),
    listRoomKeyRecords: vi.fn(),
  },
}));

vi.mock("@/app/shared/log-app-event", () => ({
  logAppEvent: vi.fn(),
}));

vi.mock("./community-membership-ledger", () => ({
  loadCommunityMembershipLedger: vi.fn(),
}));

vi.mock("./community-coordination-room-key-owner", () => ({
  resolveRoomKeyForCommunityAction: vi.fn(),
}));

vi.mock("./community-coordination-membership-directory-store", () => ({
  loadCoordinationMembershipDirectory: vi.fn(),
}));

vi.mock("../../crypto/crypto-service", () => ({
  cryptoService: {
    encryptGroupMessage: vi.fn(),
    signEvent: vi.fn(),
  },
}));

vi.mock("@/app/features/profiles/services/profile-runtime-scope", () => ({
  getResolvedProfileId: () => "profile-a",
}));

vi.mock("@/app/features/profiles/services/profile-scope", () => ({
  readRegistryBackedActiveProfileId: () => "profile-a",
  getProfileScopeOverride: () => null,
}));

const MY_PUBLIC_KEY = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as PublicKeyHex;
const MY_PRIVATE_KEY = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as PrivateKeyHex;
const COORDINATION_ROOM_KEY = "c".repeat(64);

describe("group-service room-key portability diagnostics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadCommunityMembershipLedger).mockReturnValue([]);
    vi.mocked(loadCoordinationMembershipDirectory).mockReturnValue(null);
    vi.mocked(resolveRoomKeyForCommunityAction).mockResolvedValue({
      roomKeyHex: null,
      source: "miss",
    });
    vi.mocked(cryptoService.encryptGroupMessage).mockResolvedValue({} as never);
    vi.mocked(cryptoService.signEvent).mockResolvedValue({
      id: "evt-sealed-1",
      kind: 10105,
      created_at: 1_700_000_000,
      tags: [],
      content: "encrypted",
      pubkey: MY_PUBLIC_KEY,
      sig: "sig",
    } as never);
  });

  it("emits no_local_room_keys diagnostics when no room keys exist", async () => {
    vi.mocked(roomKeyStore.getRoomKeyRecord).mockResolvedValue(null);
    vi.mocked(roomKeyStore.listRoomKeyRecords).mockResolvedValue([]);
    const service = new GroupService(MY_PUBLIC_KEY, MY_PRIVATE_KEY);

    await expect(service.sendSealedMessage({
      groupId: "group-alpha",
      content: "hello",
    })).rejects.toThrow("No room key found for this community on this device");

    expect(logAppEvent).toHaveBeenCalledWith(expect.objectContaining({
      name: "groups.room_key_missing_send_blocked",
      level: "warn",
      context: expect.objectContaining({
        reasonCode: "no_local_room_keys",
        localRoomKeyCount: 0,
        hasTargetGroupRecord: false,
        activeProfileId: "profile-a",
      }),
    }));
  });

  it("emits profile-scope mismatch diagnostics when target group key is missing but other keys exist", async () => {
    vi.mocked(roomKeyStore.getRoomKeyRecord).mockResolvedValue(null);
    vi.mocked(roomKeyStore.listRoomKeyRecords).mockResolvedValue([
      {
        groupId: "other-group-1",
        roomKeyHex: "roomkey1",
        createdAt: 1,
      },
      {
        groupId: "other-group-2",
        roomKeyHex: "roomkey2",
        createdAt: 2,
      },
    ]);
    const service = new GroupService(MY_PUBLIC_KEY, MY_PRIVATE_KEY);

    await expect(service.sendSealedMessage({
      groupId: "group-beta",
      content: "hello",
    })).rejects.toThrow("No room key found for this community on this device");

    expect(logAppEvent).toHaveBeenCalledWith(expect.objectContaining({
      name: "groups.room_key_missing_send_blocked",
      context: expect.objectContaining({
        reasonCode: "target_room_key_missing_local_profile_scope",
        localRoomKeyCount: 2,
        hasTargetGroupRecord: false,
      }),
    }));
  });

  it("emits joined-membership diagnostics when membership exists but target room key is missing", async () => {
    vi.mocked(roomKeyStore.getRoomKeyRecord).mockResolvedValue(null);
    vi.mocked(roomKeyStore.listRoomKeyRecords).mockResolvedValue([
      {
        groupId: "unrelated-group",
        roomKeyHex: "roomkey-unrelated",
        createdAt: 3,
      },
    ]);
    vi.mocked(loadCommunityMembershipLedger).mockReturnValue([
      {
        communityId: "group-joined:wss://relay.joined",
        groupId: "group-joined",
        relayUrl: "wss://relay.joined",
        status: "joined",
        updatedAtUnixMs: 5_000,
      },
    ]);
    vi.mocked(loadCoordinationMembershipDirectory).mockReturnValue({
      activeMemberPubkeys: [MY_PUBLIC_KEY],
      leftMemberPubkeys: [],
      expelledMemberPubkeys: [],
      headSeq: 1,
    });
    const service = new GroupService(MY_PUBLIC_KEY, MY_PRIVATE_KEY);

    await expect(service.sendSealedMessage({
      groupId: "group-joined",
      content: "hello",
    })).rejects.toThrow("No room key found for this community on this device");

    expect(resolveRoomKeyForCommunityAction).toHaveBeenCalledWith(expect.objectContaining({
      groupId: "group-joined",
      localPubkey: MY_PUBLIC_KEY,
      localPrivateKeyHex: MY_PRIVATE_KEY,
    }));
    expect(logAppEvent).toHaveBeenCalledWith(expect.objectContaining({
      name: "groups.room_key_missing_send_blocked",
      context: expect.objectContaining({
        reasonCode: "target_room_key_missing_after_membership_joined",
        hasTargetJoinedMembership: true,
      }),
    }));
  });

  it("sends when coordination action-time resolve materializes a missing local key", async () => {
    vi.mocked(roomKeyStore.getRoomKeyRecord).mockResolvedValue(null);
    vi.mocked(loadCommunityMembershipLedger).mockReturnValue([
      {
        communityId: "comm-wrap-1",
        groupId: "group-wrap",
        relayUrl: "ws://localhost:7000",
        status: "joined",
        updatedAtUnixMs: 5_000,
      },
    ]);
    vi.mocked(loadCoordinationMembershipDirectory).mockReturnValue({
      activeMemberPubkeys: [MY_PUBLIC_KEY],
      leftMemberPubkeys: [],
      expelledMemberPubkeys: [],
      headSeq: 1,
    });
    vi.mocked(resolveRoomKeyForCommunityAction).mockResolvedValue({
      roomKeyHex: COORDINATION_ROOM_KEY,
      source: "hit_coordination",
    });
    const service = new GroupService(MY_PUBLIC_KEY, MY_PRIVATE_KEY);

    const event = await service.sendSealedMessage({
      groupId: "group-wrap",
      communityId: "comm-wrap-1",
      content: "hello from coordination key",
    });

    expect(event.id).toBe("evt-sealed-1");
    expect(resolveRoomKeyForCommunityAction).toHaveBeenCalledWith(expect.objectContaining({
      groupId: "group-wrap",
      communityId: "comm-wrap-1",
    }));
    expect(cryptoService.encryptGroupMessage).toHaveBeenCalledWith(
      expect.stringContaining("hello from coordination key"),
      COORDINATION_ROOM_KEY,
    );
    expect(logAppEvent).not.toHaveBeenCalledWith(expect.objectContaining({
      name: "groups.room_key_missing_send_blocked",
    }));
  });

  it("skips coordination resolve when explicit roomKeyHex is provided", async () => {
    const service = new GroupService(MY_PUBLIC_KEY, MY_PRIVATE_KEY);
    await service.sendSealedMessage({
      groupId: "group-direct",
      content: "hello",
      roomKeyHex: COORDINATION_ROOM_KEY,
    });
    expect(resolveRoomKeyForCommunityAction).not.toHaveBeenCalled();
    expect(roomKeyStore.getRoomKeyRecord).not.toHaveBeenCalled();
  });
});
