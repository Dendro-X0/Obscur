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
      reason: "identity_unlock_changed",
      atUnixMs: 789,
    })).toEqual({
      reason: "identity_unlock_changed",
      atUnixMs: 789,
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
});
