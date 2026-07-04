import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  COORDINATION_DIRECTORY_MIN_REFRESH_MS,
  materializeCoordinationRoomKeysAfterDirectoryRefresh,
  refreshCoordinationMembershipDirectory,
  resetCoordinationMembershipDirectoryForTests,
  saveCoordinationMembershipDirectory,
} from "./community-coordination-membership-directory-store";
import { createEmptyCoordinationMembershipMaterialization } from "./community-coordination-membership-materializer";

const fetchDeltas = vi.fn();
const fetchHead = vi.fn();
const fetchWraps = vi.fn();
const materializeWraps = vi.fn();

vi.mock("./community-coordination-membership-client", () => ({
  fetchCoordinationMembershipDeltasSince: (...args: unknown[]) => fetchDeltas(...args),
  fetchCoordinationMembershipHead: (...args: unknown[]) => fetchHead(...args),
}));

vi.mock("./community-coordination-room-key-owner", () => ({
  fetchCoordinationRoomKeyWrapsSince: (...args: unknown[]) => fetchWraps(...args),
  materializeRoomKeysFromCoordinationWraps: (...args: unknown[]) => materializeWraps(...args),
}));

vi.mock("./community-membership-sync-mode", () => ({
  isCoordinationConfigured: () => true,
}));

vi.mock("@/app/features/profiles/services/profile-runtime-scope", () => ({
  getResolvedProfileId: () => "profile-test",
}));

describe("refreshCoordinationMembershipDirectory", () => {
  beforeEach(() => {
    resetCoordinationMembershipDirectoryForTests();
    fetchDeltas.mockReset();
    fetchHead.mockReset();
    fetchWraps.mockReset();
    materializeWraps.mockReset();
    fetchDeltas.mockResolvedValue({ ok: true, deltas: [] });
    fetchHead.mockResolvedValue(null);
    fetchWraps.mockResolvedValue({ ok: true, wraps: [] });
    materializeWraps.mockResolvedValue({ materialized: true, roomKeyHex: "aa".repeat(32) });
  });

  afterEach(() => {
    resetCoordinationMembershipDirectoryForTests();
  });

  it("throttles incremental refresh when cache is warm", async () => {
    saveCoordinationMembershipDirectory({
      communityId: "community-1",
      materialization: {
        ...createEmptyCoordinationMembershipMaterialization(),
        headSeq: 3,
        activeMemberPubkeys: ["a".repeat(64) as never],
      },
      profileId: "profile-test",
    });

    await refreshCoordinationMembershipDirectory({
      communityId: "community-1",
      profileId: "profile-test",
    });
    expect(fetchDeltas).toHaveBeenCalledTimes(1);

    await refreshCoordinationMembershipDirectory({
      communityId: "community-1",
      profileId: "profile-test",
    });
    expect(fetchDeltas).toHaveBeenCalledTimes(1);
  });

  it("allows refresh after throttle window", async () => {
    const nowSpy = vi.spyOn(Date, "now");
    let nowMs = 1_000_000;
    nowSpy.mockImplementation(() => nowMs);

    saveCoordinationMembershipDirectory({
      communityId: "community-1",
      materialization: {
        ...createEmptyCoordinationMembershipMaterialization(),
        headSeq: 2,
      },
      profileId: "profile-test",
    });

    await refreshCoordinationMembershipDirectory({
      communityId: "community-1",
      profileId: "profile-test",
    });
    nowMs += COORDINATION_DIRECTORY_MIN_REFRESH_MS + 1;
    await refreshCoordinationMembershipDirectory({
      communityId: "community-1",
      profileId: "profile-test",
    });

    expect(fetchDeltas).toHaveBeenCalledTimes(2);
    nowSpy.mockRestore();
  });

  it("dedupes concurrent in-flight refresh", async () => {
    let resolveFetch: ((value: { ok: true; deltas: [] }) => void) | undefined;
    fetchDeltas.mockImplementation(() => new Promise((resolve) => {
      resolveFetch = resolve;
    }));

    const first = refreshCoordinationMembershipDirectory({
      communityId: "community-2",
      profileId: "profile-test",
    });
    const second = refreshCoordinationMembershipDirectory({
      communityId: "community-2",
      profileId: "profile-test",
    });

    resolveFetch?.({ ok: true, deltas: [] });
    await Promise.all([first, second]);
    expect(fetchDeltas).toHaveBeenCalledTimes(1);
  });

  it("rebuilds from seq 0 when server head is behind cached materialization", async () => {
    saveCoordinationMembershipDirectory({
      communityId: "community-reset",
      materialization: {
        ...createEmptyCoordinationMembershipMaterialization(),
        headSeq: 8,
        activeMemberPubkeys: ["stale".padEnd(64, "a") as never],
      },
      profileId: "profile-test",
    });

    fetchHead.mockResolvedValue({
      communityId: "community-reset",
      seq: 2,
      headHash: "abc",
      updatedAtUnixMs: Date.now(),
    });
    fetchDeltas
      .mockResolvedValueOnce({ ok: true, deltas: [] })
      .mockResolvedValueOnce({
        ok: true,
        deltas: [{
          deltaId: "d1",
          communityId: "community-reset",
          seq: 1,
          action: "join",
          subjectPubkey: "b".repeat(64),
          actorPubkey: "b".repeat(64),
          createdAtUnixMs: Date.now(),
          signature: "sig",
        }],
      })
      .mockResolvedValue({ ok: true, deltas: [] });

    const materialization = await refreshCoordinationMembershipDirectory({
      communityId: "community-reset",
      profileId: "profile-test",
    });

    expect(fetchHead).toHaveBeenCalled();
    expect(materialization?.headSeq).toBe(1);
    expect(materialization?.activeMemberPubkeys).toEqual(["b".repeat(64)]);
  });

  it("materializes room keys after directory refresh when context is provided", async () => {
    const localPubkey = ("c".repeat(64)) as `${string}`;
    fetchDeltas.mockResolvedValue({
      ok: true,
      deltas: [{
        deltaId: "d-wrap",
        communityId: "community-wrap",
        seq: 1,
        action: "join",
        subjectPubkey: localPubkey,
        actorPubkey: localPubkey,
        createdAtUnixMs: Date.now(),
        signature: "sig",
      }],
    });

    await refreshCoordinationMembershipDirectory({
      communityId: "community-wrap",
      profileId: "profile-test",
      forceFull: true,
      roomKeyMaterialization: {
        localPubkey,
        localPrivateKeyHex: "d".repeat(64) as `${string}`,
        groupId: "group-wrap",
      },
    });

    expect(fetchWraps).toHaveBeenCalledWith("community-wrap", 0);
    expect(materializeWraps).toHaveBeenCalledWith(expect.objectContaining({
      communityId: "community-wrap",
      groupId: "group-wrap",
      localPubkey,
    }));
  });

  it("skips room key materialization when directory materialization is unchanged", async () => {
    const materialization = {
      ...createEmptyCoordinationMembershipMaterialization(),
      headSeq: 1,
      activeMemberPubkeys: ["e".repeat(64) as never],
    };
    saveCoordinationMembershipDirectory({
      communityId: "community-stable",
      materialization,
      profileId: "profile-test",
    });
    fetchDeltas.mockResolvedValue({ ok: true, deltas: [] });

    await refreshCoordinationMembershipDirectory({
      communityId: "community-stable",
      profileId: "profile-test",
      roomKeyMaterialization: {
        localPubkey: "e".repeat(64) as `${string}`,
        localPrivateKeyHex: "f".repeat(64) as `${string}`,
        groupId: "group-stable",
      },
    });

    expect(fetchWraps).not.toHaveBeenCalled();
    expect(materializeWraps).not.toHaveBeenCalled();
  });
});

describe("materializeCoordinationRoomKeysAfterDirectoryRefresh", () => {
  beforeEach(() => {
    fetchWraps.mockReset();
    materializeWraps.mockReset();
    fetchWraps.mockResolvedValue({ ok: true, wraps: [{ wrapSeq: 1 }] });
    materializeWraps.mockResolvedValue({ materialized: true, roomKeyHex: "aa".repeat(32) });
  });

  it("returns early when materialization context is missing", async () => {
    const result = await materializeCoordinationRoomKeysAfterDirectoryRefresh({
      communityId: "community-1",
      materialization: createEmptyCoordinationMembershipMaterialization(),
    });
    expect(result).toEqual({
      materialized: false,
      roomKeyHex: null,
      error: "materialization_context_missing",
    });
  });
});
