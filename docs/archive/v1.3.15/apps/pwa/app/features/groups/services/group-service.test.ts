import { describe, expect, it, vi, beforeEach } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import { GroupService } from "./group-service";
import { roomKeyStore } from "../../crypto/room-key-store";
import { logAppEvent } from "@/app/shared/log-app-event";
import { loadCommunityMembershipLedger } from "./community-membership-ledger";

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

vi.mock("@/app/features/profiles/services/profile-scope", () => ({
  getActiveProfileIdSafe: () => "profile-a",
}));

const MY_PUBLIC_KEY = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as PublicKeyHex;
const MY_PRIVATE_KEY = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as PrivateKeyHex;

describe("group-service room-key portability diagnostics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadCommunityMembershipLedger).mockReturnValue([]);
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
    const service = new GroupService(MY_PUBLIC_KEY, MY_PRIVATE_KEY);

    await expect(service.sendSealedMessage({
      groupId: "group-joined",
      content: "hello",
    })).rejects.toThrow("No room key found for this community on this device");

    expect(logAppEvent).toHaveBeenCalledWith(expect.objectContaining({
      name: "groups.room_key_missing_send_blocked",
      context: expect.objectContaining({
        reasonCode: "target_room_key_missing_after_membership_joined",
        hasTargetJoinedMembership: true,
      }),
    }));
  });
});
