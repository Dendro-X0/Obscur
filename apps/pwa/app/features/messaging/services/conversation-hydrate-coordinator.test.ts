import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cancelCoalescedConversationHydrate,
  resetConversationHydrateCoordinatorForTests,
  scheduleCoalescedConversationHydrate,
} from "./conversation-hydrate-coordinator";

describe("conversation-hydrate-coordinator", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetConversationHydrateCoordinatorForTests();
  });

  afterEach(() => {
    resetConversationHydrateCoordinatorForTests();
    vi.useRealTimers();
  });

  it("debounces duplicate hydrate requests", () => {
    const run = vi.fn();
    scheduleCoalescedConversationHydrate("profile-a", "conv-1", run);
    scheduleCoalescedConversationHydrate("profile-a", "conv-1", run);
    expect(run).not.toHaveBeenCalled();
    vi.advanceTimersByTime(220);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("runs immediately when requested", () => {
    const run = vi.fn();
    scheduleCoalescedConversationHydrate("profile-a", "conv-1", run, { immediate: true });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("cancels a pending hydrate", () => {
    const run = vi.fn();
    scheduleCoalescedConversationHydrate("profile-a", "conv-1", run);
    cancelCoalescedConversationHydrate("profile-a", "conv-1");
    vi.advanceTimersByTime(500);
    expect(run).not.toHaveBeenCalled();
  });
});
