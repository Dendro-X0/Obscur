import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  accountSyncMutationSignalInternals,
  emitAccountSyncMutation,
  subscribeAccountSyncMutation,
} from "./account-sync-mutation-signal";

vi.mock("@/app/features/profiles/services/profile-runtime-scope", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/features/profiles/services/profile-runtime-scope")>();
  return {
    ...actual,
    getResolvedProfileId: vi.fn(() => ""),
  };
});

const { getResolvedProfileId } = await import("@/app/features/profiles/services/profile-runtime-scope");

describe("account-sync-mutation-signal profile isolation", () => {
  beforeEach(() => {
    accountSyncMutationSignalInternals.clearLatestMutationCacheForTests();
    vi.mocked(getResolvedProfileId).mockReturnValue("");
  });

  afterEach(() => {
    accountSyncMutationSignalInternals.clearLatestMutationCacheForTests();
  });

  it("includes profileId on emitted detail", () => {
    vi.mocked(getResolvedProfileId).mockReturnValue("profile-a");
    emitAccountSyncMutation("chat_state_changed");
    expect(accountSyncMutationSignalInternals.getLatestMutationDetailForProfile("profile-a")).toEqual(
      expect.objectContaining({
        reason: "chat_state_changed",
        profileId: "profile-a",
      }),
    );
  });

  it("does not deliver profile A mutations to profile B subscribers", () => {
    const profileBListener = vi.fn();
    subscribeAccountSyncMutation(profileBListener, { profileId: "profile-b" });
    profileBListener.mockClear();

    emitAccountSyncMutation("message_delete_tombstones_changed", { profileId: "profile-a" });

    expect(profileBListener).not.toHaveBeenCalled();
  });

  it("replays latest mutation only for the matching profile when replayOnSubscribe is enabled", () => {
    emitAccountSyncMutation("dm_history_changed", { profileId: "profile-a" });
    const profileBListener = vi.fn();
    subscribeAccountSyncMutation(profileBListener, {
      profileId: "profile-b",
      replayOnSubscribe: true,
    });

    expect(profileBListener).not.toHaveBeenCalled();

    const profileAListener = vi.fn();
    subscribeAccountSyncMutation(profileAListener, {
      profileId: "profile-a",
      replayOnSubscribe: true,
    });

    expect(profileAListener).toHaveBeenCalledTimes(1);
    expect(profileAListener).toHaveBeenCalledWith(expect.objectContaining({
      reason: "dm_history_changed",
      profileId: "profile-a",
    }));
  });
});
