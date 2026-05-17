import { describe, expect, it, vi } from "vitest";

import {
  accountSyncMutationSignalInternals,
  emitAccountSyncMutation,
  subscribeAccountSyncMutation,
} from "./account-sync-mutation-signal";

describe("account-sync-mutation-signal", () => {
  it("normalizes valid mutation detail and rejects invalid values", () => {
    expect(accountSyncMutationSignalInternals.toMutationDetail(null)).toBeNull();
    expect(accountSyncMutationSignalInternals.toMutationDetail({ reason: "unknown" })).toBeNull();
    expect(accountSyncMutationSignalInternals.toMutationDetail({
      reason: "peer_trust_changed",
      atUnixMs: 123,
    })).toEqual({
      reason: "peer_trust_changed",
      atUnixMs: 123,
    });
    expect(accountSyncMutationSignalInternals.toMutationDetail({
      reason: "chat_state_changed",
      atUnixMs: 456,
    })).toEqual({
      reason: "chat_state_changed",
      atUnixMs: 456,
    });
    expect(accountSyncMutationSignalInternals.toMutationDetail({
      reason: "dm_history_changed",
      atUnixMs: 567,
    })).toEqual({
      reason: "dm_history_changed",
      atUnixMs: 567,
    });
    expect(accountSyncMutationSignalInternals.toMutationDetail({
      reason: "message_delete_tombstones_changed",
      atUnixMs: 654,
    })).toEqual({
      reason: "message_delete_tombstones_changed",
      atUnixMs: 654,
    });
    expect(accountSyncMutationSignalInternals.toMutationDetail({
      reason: "identity_unlock_changed",
      atUnixMs: 789,
    })).toEqual({
      reason: "identity_unlock_changed",
      atUnixMs: 789,
    });
    expect(accountSyncMutationSignalInternals.toMutationDetail({
      reason: "community_membership_changed",
      atUnixMs: 999,
    })).toEqual({
      reason: "community_membership_changed",
      atUnixMs: 999,
    });
  });

  it("dispatches and subscribes to mutation events", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeAccountSyncMutation(listener);

    emitAccountSyncMutation("requests_inbox_status_changed");

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({
      reason: "requests_inbox_status_changed",
    }));

    unsubscribe();
  });

  it("replays latest mutation to late subscribers", () => {
    emitAccountSyncMutation("chat_state_changed");
    const listener = vi.fn();

    const unsubscribe = subscribeAccountSyncMutation(listener);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({
      reason: "chat_state_changed",
    }));
    expect(accountSyncMutationSignalInternals.getLatestMutationDetail()).toEqual(
      expect.objectContaining({ reason: "chat_state_changed" })
    );

    unsubscribe();
  });
});
