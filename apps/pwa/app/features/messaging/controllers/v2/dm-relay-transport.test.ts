import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { NostrFilter, RelayPoolContract } from "./dm-controller-types";
import { subscribeToIncomingDMs } from "./dm-relay-transport";

const createMinimalRelayPool = (overrides: Partial<RelayPoolContract>): RelayPoolContract => ({
  connections: [],
  sendToOpen: vi.fn(),
  subscribeToMessages: vi.fn(() => () => {}),
  subscribe: vi.fn(() => "sub-1"),
  unsubscribe: vi.fn(),
  waitForConnection: vi.fn(async () => true),
  ...overrides,
});

describe("subscribeToIncomingDMs", () => {
  const fixedNowMs = Date.UTC(2026, 0, 15, 12, 0, 0);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedNowMs);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("adds delivery fallback relays as transient so REQ matches hybrid publish scope", () => {
    const addTransientRelay = vi.fn();
    const subscribe = vi.fn().mockReturnValue("sub-1");
    const pool = createMinimalRelayPool({ subscribe, addTransientRelay });

    subscribeToIncomingDMs({
      pool,
      myPublicKeyHex: "a".repeat(64),
      onEvent: vi.fn(),
    });

    expect(addTransientRelay).toHaveBeenCalledTimes(3);
    expect(addTransientRelay).toHaveBeenCalledWith("wss://relay.damus.io");
    expect(addTransientRelay).toHaveBeenCalledWith("wss://nos.lol");
    expect(addTransientRelay).toHaveBeenCalledWith("wss://relay.primal.net");
  });

  it("normalizes pubkey to lowercase and uses 7d since lookback with higher limit", () => {
    const subscribe = vi.fn().mockReturnValue("sub-1");
    const pool = createMinimalRelayPool({ subscribe });

    subscribeToIncomingDMs({
      pool,
      myPublicKeyHex: "  ABCDEF  ",
      onEvent: vi.fn(),
    });

    expect(subscribe).toHaveBeenCalledTimes(1);
    const [filters] = subscribe.mock.calls[0] as [ReadonlyArray<NostrFilter>];
    expect(filters[0].kinds).toEqual([4, 1059]);
    expect(filters[0]["#p"]).toEqual(["abcdef"]);
    expect(filters[0].limit).toBe(200);
    expect(filters[1].kinds).toEqual([4]);
    expect(filters[1].authors).toEqual(["abcdef"]);
    expect(filters[1].limit).toBe(200);

    const expectedSince = Math.max(0, Math.floor(fixedNowMs / 1000) - 86400 * 7);
    expect(filters[0].since).toBe(expectedSince);
    expect(filters[1].since).toBe(expectedSince);
  });
});
