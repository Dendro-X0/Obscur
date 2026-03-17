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
    vi.useRealTimers();
  });

  it("is idempotent on duplicate subscribe attempts", () => {
    const hasSubscribedRef = { current: false };
    const activeSubscriptions = { current: new Map<string, any>() };
    const closedSubscriptionIdsRef = { current: new Set<string>() };
    const setState = vi.fn();
    const pool = {
      connections: [{ url: "wss://relay.example", status: "open" }],
      subscribe: vi.fn(() => "sub-1"),
      unsubscribe: vi.fn(),
    };

    const params = {
      myPublicKeyHex: "a".repeat(64),
      pool,
      hasSubscribedRef,
      activeSubscriptions,
      closedSubscriptionIdsRef,
      setState,
      onEvent: vi.fn(),
    };

    subscribeToIncomingDMs(params as any);
    subscribeToIncomingDMs(params as any);

    expect(pool.subscribe).toHaveBeenCalledTimes(1);
    expect(activeSubscriptions.current.size).toBe(1);
  });

  it("suppresses duplicate close churn", () => {
    const hasSubscribedRef = { current: true };
    const closedSubscriptionIdsRef = { current: new Set<string>() };
    const setState = vi.fn();
    const pool = {
      connections: [{ url: "wss://relay.example", status: "open" }],
      subscribe: vi.fn(() => "sub-1"),
      unsubscribe: vi.fn(),
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

    const params = { pool, activeSubscriptions, closedSubscriptionIdsRef, hasSubscribedRef, setState };
    unsubscribeFromDMs(params as any);

    activeSubscriptions.current.set("sub-1", {
      id: "sub-1",
      filter: { kinds: [4] },
      isActive: true,
      createdAt: new Date(),
      eventCount: 0,
    });
    unsubscribeFromDMs(params as any);

    expect(pool.unsubscribe).toHaveBeenCalledTimes(1);
    expect(hasSubscribedRef.current).toBe(false);
  });

  it("does not suppress close for a separate runtime instance", () => {
    const pool = {
      connections: [{ url: "wss://relay.example", status: "open" }],
      subscribe: vi.fn(() => "sub-1"),
      unsubscribe: vi.fn(),
    };
    const buildRuntimeParams = () => ({
      pool,
      setState: vi.fn(),
      hasSubscribedRef: { current: true },
      closedSubscriptionIdsRef: { current: new Set<string>() },
      activeSubscriptions: {
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
      },
    });

    unsubscribeFromDMs(buildRuntimeParams() as any);
    unsubscribeFromDMs(buildRuntimeParams() as any);

    expect(pool.unsubscribe).toHaveBeenCalledTimes(2);
  });

  it("fences live subscriptions to now so backlog replay is handled by sync", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-14T00:00:00Z"));

    const hasSubscribedRef = { current: false };
    const activeSubscriptions = { current: new Map<string, any>() };
    const closedSubscriptionIdsRef = { current: new Set<string>() };
    const setState = vi.fn();
    const pool = {
      connections: [{ url: "wss://relay.example", status: "open" }],
      subscribe: vi.fn(() => "sub-1"),
      unsubscribe: vi.fn(),
    };

    subscribeToIncomingDMs({
      myPublicKeyHex: "a".repeat(64),
      pool,
      hasSubscribedRef,
      activeSubscriptions,
      closedSubscriptionIdsRef,
      setState,
      onEvent: vi.fn(),
    } as any);

    const expectedSinceUnixSeconds = Math.floor(new Date("2026-03-14T00:00:00Z").getTime() / 1000);
    expect(pool.subscribe).toHaveBeenCalledWith(
      [expect.objectContaining({
        kinds: [4, 1059],
        "#p": ["a".repeat(64)],
        limit: 50,
        since: expectedSinceUnixSeconds,
      })],
      expect.any(Function)
    );
  });
});
