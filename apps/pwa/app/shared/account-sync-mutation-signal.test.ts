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
    getResolvedProfileId: vi.fn(() => "test-profile"),
  };
});

describe("account-sync-mutation-signal", () => {
  beforeEach(() => {
    accountSyncMutationSignalInternals.clearLatestMutationCacheForTests();
  });

  afterEach(() => {
    accountSyncMutationSignalInternals.clearLatestMutationCacheForTests();
  });
  it("normalizes valid mutation detail and rejects invalid values", () => {
    expect(accountSyncMutationSignalInternals.toMutationDetail(null)).toBeNull();
    expect(accountSyncMutationSignalInternals.toMutationDetail({ reason: "unknown" })).toBeNull();
    expect(accountSyncMutationSignalInternals.toMutationDetail({
      reason: "peer_trust_changed",
      atUnixMs: 123,
      profileId: "profile-a",
    })).toEqual({
      reason: "peer_trust_changed",
      atUnixMs: 123,
      profileId: "profile-a",
    });
    expect(accountSyncMutationSignalInternals.toMutationDetail({
      reason: "chat_state_changed",
      atUnixMs: 456,
    })).toEqual({
      reason: "chat_state_changed",
      atUnixMs: 456,
      profileId: "",
    });
    expect(accountSyncMutationSignalInternals.toMutationDetail({
      reason: "dm_history_changed",
      atUnixMs: 567,
    })).toEqual({
      reason: "dm_history_changed",
      atUnixMs: 567,
      profileId: "",
    });
    expect(accountSyncMutationSignalInternals.toMutationDetail({
      reason: "message_delete_tombstones_changed",
      atUnixMs: 654,
    })).toEqual({
      reason: "message_delete_tombstones_changed",
      atUnixMs: 654,
      profileId: "",
    });
    expect(accountSyncMutationSignalInternals.toMutationDetail({
      reason: "identity_unlock_changed",
      atUnixMs: 789,
    })).toEqual({
      reason: "identity_unlock_changed",
      atUnixMs: 789,
      profileId: "",
    });
    expect(accountSyncMutationSignalInternals.toMutationDetail({
      reason: "community_membership_changed",
      atUnixMs: 999,
    })).toEqual({
      reason: "community_membership_changed",
      atUnixMs: 999,
      profileId: "",
    });
  });

  it("dispatches and subscribes to mutation events", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeAccountSyncMutation(listener);

    emitAccountSyncMutation("requests_inbox_status_changed");

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({
      reason: "requests_inbox_status_changed",
      profileId: "test-profile",
    }));

    unsubscribe();
  });

  it("does not replay cached mutations to late subscribers by default", () => {
    emitAccountSyncMutation("chat_state_changed");
    const listener = vi.fn();
    const unsubscribe = subscribeAccountSyncMutation(listener);
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("replays latest mutation to late subscribers when opted in", () => {
    emitAccountSyncMutation("chat_state_changed");
    const listener = vi.fn();

    const unsubscribe = subscribeAccountSyncMutation(listener, { replayOnSubscribe: true });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({
      reason: "chat_state_changed",
      profileId: "test-profile",
    }));
    expect(accountSyncMutationSignalInternals.getLatestMutationDetail()).toEqual(
      expect.objectContaining({ reason: "chat_state_changed", profileId: "test-profile" })
    );

    unsubscribe();
  });
});
