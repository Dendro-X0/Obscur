import { beforeEach, describe, expect, it, vi } from "vitest";

const refreshMocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
}));

vi.mock("@/app/features/runtime/runtime-capabilities", () => ({
  hasNativeRuntime: () => true,
}));

vi.mock("@/app/features/messaging/services/message-persistence-service", () => ({
  dispatchMessagesIndexRebuiltEvent: refreshMocks.dispatch,
}));

import { runSecondaryProfileDmSoftRefresh } from "./secondary-profile-dm-soft-refresh";

describe("runSecondaryProfileDmSoftRefresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("re-triggers sqlite-backed hydrate for secondary profiles without chat-state repair", () => {
    const listener = vi.fn();
    window.addEventListener("obscur:secondary-profile-dm-soft-refresh", listener);

    const result = runSecondaryProfileDmSoftRefresh({
      profileId: "profile-2",
      myPublicKeyHex: "a".repeat(64) as any,
      reason: "post_login",
    });

    expect(result.repairedMessageCount).toBe(0);
    expect(refreshMocks.dispatch).toHaveBeenCalledWith(expect.objectContaining({
      profileId: "profile-2",
      messageCount: 0,
    }));
    expect(listener).toHaveBeenCalled();
    const event = listener.mock.calls[0]?.[0] as CustomEvent;
    expect(event.detail).toMatchObject({
      profileId: "profile-2",
      forceIndexedAuthority: true,
      repairedMessageCount: 0,
    });

    window.removeEventListener("obscur:secondary-profile-dm-soft-refresh", listener);
  });

  it("skips default profile windows", () => {
    const result = runSecondaryProfileDmSoftRefresh({
      profileId: "default",
      myPublicKeyHex: "a".repeat(64) as any,
      reason: "post_login",
    });
    expect(result.repairedMessageCount).toBe(0);
    expect(refreshMocks.dispatch).not.toHaveBeenCalled();
  });
});
