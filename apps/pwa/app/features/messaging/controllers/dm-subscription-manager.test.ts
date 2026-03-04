import { beforeEach, describe, expect, it, vi } from "vitest";
import { subscribeToIncomingDMs, unsubscribeFromDMs } from "./dm-subscription-manager";

const logRuntimeEventMock = vi.fn();

vi.mock("@/app/shared/runtime-log-classification", () => ({
  logRuntimeEvent: (...args: ReadonlyArray<unknown>) => logRuntimeEventMock(...args),
}));

vi.mock("./relay-utils", () => ({
  generateSubscriptionId: () => "sub-fixed-id",
}));

describe("dm-subscription-manager", () => {
  beforeEach(() => {
    logRuntimeEventMock.mockReset();
  });

  it("is idempotent on duplicate subscribe attempts", () => {
    const hasSubscribedRef = { current: false };
    const activeSubscriptions = { current: new Map<string, any>() };
    const setState = vi.fn();
    const pool = {
      connections: [{ url: "wss://relay.example", status: "open" }],
      sendToOpen: vi.fn(),
    };

    const params = {
      myPublicKeyHex: "a".repeat(64),
      pool,
      hasSubscribedRef,
      activeSubscriptions,
      setState,
    };

    subscribeToIncomingDMs(params as any);
    subscribeToIncomingDMs(params as any);

    expect(pool.sendToOpen).toHaveBeenCalledTimes(1);
    expect(activeSubscriptions.current.size).toBe(1);
  });

  it("suppresses duplicate close churn", () => {
    const hasSubscribedRef = { current: true };
    const setState = vi.fn();
    const pool = {
      connections: [{ url: "wss://relay.example", status: "open" }],
      sendToOpen: vi.fn(),
    };
    const activeSubscriptions = {
      current: new Map<string, any>([
        [
          "sub-1",
          {
            id: "sub-1",
            filter: { kinds: [4] },
            isActive: true,
            createdAt: new Date(),
            eventCount: 0,
          },
        ],
      ]),
    };

    const params = { pool, activeSubscriptions, hasSubscribedRef, setState };
    unsubscribeFromDMs(params as any);

    activeSubscriptions.current.set("sub-1", {
      id: "sub-1",
      filter: { kinds: [4] },
      isActive: true,
      createdAt: new Date(),
      eventCount: 0,
    });
    unsubscribeFromDMs(params as any);

    expect(pool.sendToOpen).toHaveBeenCalledTimes(1);
    expect(hasSubscribedRef.current).toBe(false);
  });
});

