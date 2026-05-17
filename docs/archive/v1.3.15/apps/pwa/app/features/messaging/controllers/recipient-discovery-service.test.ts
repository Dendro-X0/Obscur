import { describe, expect, it, vi } from "vitest";
import { ensureConnectedToRecipientRelays } from "./recipient-discovery-service";

describe("recipient-discovery-service", () => {
  const pubkey = "b".repeat(64);

  const createPool = () => {
    let handler: ((params: Readonly<{ message: string }>) => void) | undefined;
    return {
      pool: {
        waitForConnection: vi.fn(async () => true),
        sendToOpen: vi.fn(),
        addTransientRelay: vi.fn(),
        subscribeToMessages: vi.fn((nextHandler: (params: Readonly<{ message: string }>) => void) => {
          handler = nextHandler;
          return () => {
            handler = undefined;
          };
        }),
      },
      emit(message: unknown) {
        handler?.({ message: JSON.stringify(message) });
      },
    };
  };

  it("does not persist an empty relay discovery result as a durable cache hit", async () => {
    const runtime = createPool();
    const recipientRelayCheckCache = { current: new Set<string>() };
    const recipientRelayResolutionCache = { current: new Map<string, ReadonlyArray<string>>() };

    const firstAttemptPromise = ensureConnectedToRecipientRelays({
      pool: runtime.pool as any,
      recipientRelayCheckCache,
      recipientRelayResolutionCache,
    }, pubkey);
    const firstReqPayload = vi.mocked(runtime.pool.sendToOpen).mock.calls[0]?.[0] as string;
    const firstSubId = JSON.parse(firstReqPayload)[1];
    runtime.emit(["EOSE", firstSubId]);
    await expect(firstAttemptPromise).resolves.toEqual([]);

    const secondAttemptPromise = ensureConnectedToRecipientRelays({
      pool: runtime.pool as any,
      recipientRelayCheckCache,
      recipientRelayResolutionCache,
    }, pubkey);
    const secondReqPayload = vi.mocked(runtime.pool.sendToOpen).mock.calls[1]?.[0] as string;
    const secondSubId = JSON.parse(secondReqPayload)[1];
    runtime.emit(["EOSE", secondSubId]);
    await expect(secondAttemptPromise).resolves.toEqual([]);

    expect(runtime.pool.sendToOpen).toHaveBeenCalledTimes(2);
    expect(recipientRelayCheckCache.current.has(pubkey)).toBe(false);
    expect(recipientRelayResolutionCache.current.has(pubkey)).toBe(false);
  });

  it("reuses a positive discovery result within the same runtime", async () => {
    const runtime = createPool();
    const recipientRelayCheckCache = { current: new Set<string>() };
    const recipientRelayResolutionCache = { current: new Map<string, ReadonlyArray<string>>() };

    const firstAttemptPromise = ensureConnectedToRecipientRelays({
      pool: runtime.pool as any,
      recipientRelayCheckCache,
      recipientRelayResolutionCache,
    }, pubkey);
    const reqPayload = vi.mocked(runtime.pool.sendToOpen).mock.calls[0]?.[0] as string;
    const subId = JSON.parse(reqPayload)[1];
    runtime.emit(["EVENT", subId, {
      kind: 10002,
      tags: [["r", "wss://recipient.example", "read"]],
    }]);
    runtime.emit(["EOSE", subId]);

    await expect(firstAttemptPromise).resolves.toEqual(["wss://recipient.example"]);

    await expect(ensureConnectedToRecipientRelays({
      pool: runtime.pool as any,
      recipientRelayCheckCache,
      recipientRelayResolutionCache,
    }, pubkey)).resolves.toEqual(["wss://recipient.example"]);

    expect(runtime.pool.sendToOpen).toHaveBeenCalledTimes(1);
    expect(runtime.pool.addTransientRelay).toHaveBeenCalledWith("wss://recipient.example");
  });

  it("filters non-wss relay hints before caching or connecting", async () => {
    const runtime = createPool();
    const recipientRelayCheckCache = { current: new Set<string>() };
    const recipientRelayResolutionCache = { current: new Map<string, ReadonlyArray<string>>() };

    const attemptPromise = ensureConnectedToRecipientRelays({
      pool: runtime.pool as any,
      recipientRelayCheckCache,
      recipientRelayResolutionCache,
    }, pubkey);
    const reqPayload = vi.mocked(runtime.pool.sendToOpen).mock.calls[0]?.[0] as string;
    const subId = JSON.parse(reqPayload)[1];

    runtime.emit(["EVENT", subId, {
      kind: 10002,
      tags: [
        ["r", "wss://trusted-a.example/", "read"],
        ["r", "ws://127.0.0.1:7001", "read"],
        ["r", "javascript:alert(1)", "read"],
      ],
    }]);
    runtime.emit(["EVENT", subId, {
      kind: 3,
      content: JSON.stringify({
        "wss://trusted-b.example": { read: true },
        "wss://trusted-default.example": {},
        "http://bad.example": { read: true },
        "wss://write-only.example": { write: true },
        "wss://read-disabled.example": { read: false },
      }),
      tags: [],
    }]);
    runtime.emit(["EOSE", subId]);

    await expect(attemptPromise).resolves.toEqual([
      "wss://trusted-a.example",
      "wss://trusted-b.example",
      "wss://trusted-default.example",
    ]);
    expect(runtime.pool.addTransientRelay).toHaveBeenCalledTimes(3);
    expect(runtime.pool.addTransientRelay).toHaveBeenNthCalledWith(1, "wss://trusted-a.example");
    expect(runtime.pool.addTransientRelay).toHaveBeenNthCalledWith(2, "wss://trusted-b.example");
    expect(runtime.pool.addTransientRelay).toHaveBeenNthCalledWith(3, "wss://trusted-default.example");
    expect(recipientRelayResolutionCache.current.get(pubkey)).toEqual([
      "wss://trusted-a.example",
      "wss://trusted-b.example",
      "wss://trusted-default.example",
    ]);
  });
});
