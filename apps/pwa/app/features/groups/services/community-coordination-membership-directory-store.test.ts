import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  COORDINATION_DIRECTORY_MIN_REFRESH_MS,
  refreshCoordinationMembershipDirectory,
  resetCoordinationMembershipDirectoryForTests,
  saveCoordinationMembershipDirectory,
} from "./community-coordination-membership-directory-store";
import { createEmptyCoordinationMembershipMaterialization } from "./community-coordination-membership-materializer";

const fetchDeltas = vi.fn();

vi.mock("./community-coordination-membership-client", () => ({
  fetchCoordinationMembershipDeltasSince: (...args: unknown[]) => fetchDeltas(...args),
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
    fetchDeltas.mockResolvedValue({ ok: true, deltas: [] });
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
});
