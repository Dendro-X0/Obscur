import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  isExclusiveLocalDevMeshTransportPool,
  isHttpOnlyMeshTransportPool,
  publishToRelays,
  resolveTargetRelayUrls,
  shouldPrimeDmDeliveryFallbackRelays,
  subscribeToIncomingDMs,
} from "./dm-relay-transport";
import type { RelayPoolContract } from "./dm-controller-types";

const nip65Mocks = vi.hoisted(() => ({
  getWriteRelays: vi.fn(() => [] as string[]),
}));

const peerRelayEvidenceMocks = vi.hoisted(() => ({
  getRelayUrls: vi.fn(() => [] as string[]),
}));

const exclusiveIntentMocks = vi.hoisted(() => ({
  readExclusiveTransportPresetIntent: vi.fn((): string | null => null),
}));

vi.mock("@/app/features/relays/utils/nip65-service", () => ({
  nip65Service: {
    getWriteRelays: nip65Mocks.getWriteRelays,
  },
}));

vi.mock("../../services/peer-relay-evidence-store", () => ({
  peerRelayEvidenceStore: {
    getRelayUrls: peerRelayEvidenceMocks.getRelayUrls,
  },
}));

vi.mock("@/app/features/transport-kernel/transport-exclusive-intent", async () => {
  const actual = await vi.importActual<typeof import("@/app/features/transport-kernel/transport-exclusive-intent")>(
    "@/app/features/transport-kernel/transport-exclusive-intent",
  );
  return {
    ...actual,
    readExclusiveTransportPresetIntent: exclusiveIntentMocks.readExclusiveTransportPresetIntent,
  };
});

type MutableRelayPool = {
  -readonly [K in keyof RelayPoolContract]: RelayPoolContract[K];
};

const createPool = (
  configuredRelayUrls: ReadonlyArray<string>,
  options?: Readonly<{ openRelayUrls?: ReadonlyArray<string> }>,
): MutableRelayPool => {
  const openRelayUrls = options?.openRelayUrls ?? configuredRelayUrls;
  const openSet = new Set(openRelayUrls.map((url) => url.trim()));
  return {
    connections: configuredRelayUrls.map((url) => ({
      url,
      status: openSet.has(url.trim()) ? "open" : "closed",
    })),
    sendToOpen: () => undefined,
    subscribeToMessages: () => () => undefined,
    subscribe: () => "sub-test",
    unsubscribe: () => undefined,
    waitForConnection: async () => true,
    getWritableRelaySnapshot: () => ({
      atUnixMs: Date.now(),
      configuredRelayUrls: [...configuredRelayUrls],
      writableRelayUrls: [...openRelayUrls],
      totalRelayCount: configuredRelayUrls.length,
      connectedRelayCount: openRelayUrls.length,
      writableRelayCount: openRelayUrls.length,
    }),
  };
};

describe("isHttpOnlyMeshTransportPool", () => {
  it("is true when every configured relay is loopback mesh HTTP", () => {
    expect(isHttpOnlyMeshTransportPool(["http://127.0.0.1:8788"])).toBe(true);
    expect(isHttpOnlyMeshTransportPool(["https://localhost:8788"])).toBe(true);
  });

  it("is false when any relay is not loopback mesh HTTP", () => {
    expect(isHttpOnlyMeshTransportPool([
      "http://127.0.0.1:8788",
      "wss://nos.lol",
    ])).toBe(false);
    expect(isHttpOnlyMeshTransportPool(["wss://nos.lol"])).toBe(false);
    expect(isHttpOnlyMeshTransportPool([])).toBe(false);
  });
});

describe("isExclusiveLocalDevMeshTransportPool", () => {
  it("is true when every configured relay is Soft L3 local WS", () => {
    expect(isExclusiveLocalDevMeshTransportPool(["ws://localhost:7000"])).toBe(true);
    expect(isExclusiveLocalDevMeshTransportPool(["ws://127.0.0.1:7000"])).toBe(true);
  });

  it("is false when any remote or empty", () => {
    expect(isExclusiveLocalDevMeshTransportPool([
      "ws://localhost:7000",
      "wss://nos.lol",
    ])).toBe(false);
    expect(isExclusiveLocalDevMeshTransportPool(["wss://nos.lol"])).toBe(false);
    expect(isExclusiveLocalDevMeshTransportPool([])).toBe(false);
  });
});

describe("resolveTargetRelayUrls", () => {
  beforeEach(() => {
    nip65Mocks.getWriteRelays.mockReset();
    nip65Mocks.getWriteRelays.mockReturnValue([]);
    peerRelayEvidenceMocks.getRelayUrls.mockReset();
    peerRelayEvidenceMocks.getRelayUrls.mockReturnValue([]);
    exclusiveIntentMocks.readExclusiveTransportPresetIntent.mockReset();
    exclusiveIntentMocks.readExclusiveTransportPresetIntent.mockReturnValue(null);
  });

  it("uses configured mesh HTTP only when pool is HTTP-only, ignoring peer evidence", () => {
    peerRelayEvidenceMocks.getRelayUrls.mockReturnValue([
      "wss://nos.lol",
      "wss://relay.damus.io",
    ]);
    nip65Mocks.getWriteRelays.mockReturnValue(["wss://relay.primal.net"]);

    const urls = resolveTargetRelayUrls({
      pool: createPool(["http://127.0.0.1:8788"]),
      peerPublicKeyHex: "b".repeat(64),
      senderPublicKeyHex: "a".repeat(64),
    });

    expect(urls).toEqual(["http://127.0.0.1:8788"]);
  });

  it("P1-O4b: Soft L3 exclusive pins localhost and ignores peer public evidence", () => {
    peerRelayEvidenceMocks.getRelayUrls.mockReturnValue([
      "wss://nos.lol",
      "wss://relay.damus.io",
    ]);
    nip65Mocks.getWriteRelays.mockReturnValue(["wss://relay.primal.net"]);

    const urls = resolveTargetRelayUrls({
      pool: createPool(["ws://localhost:7000"], {
        // Supervisor may report writable without connections[].status===open
        openRelayUrls: [],
      }),
      peerPublicKeyHex: "b".repeat(64),
      senderPublicKeyHex: "a".repeat(64),
      customTags: [["t", "connection-cancel"]],
    });

    expect(urls).toEqual(["ws://localhost:7000"]);
  });

  it("P1-O4b: sticky exclusive intent pins Soft L3 when engine configured still lists remotes", () => {
    exclusiveIntentMocks.readExclusiveTransportPresetIntent.mockReturnValue("local_dev_mesh");
    peerRelayEvidenceMocks.getRelayUrls.mockReturnValue(["wss://nos.lol"]);
    nip65Mocks.getWriteRelays.mockReturnValue(["wss://relay.primal.net"]);

    const urls = resolveTargetRelayUrls({
      pool: createPool(
        ["ws://localhost:7000", "wss://nos.lol", "wss://relay.primal.net"],
        { openRelayUrls: ["ws://localhost:7000"] },
      ),
      peerPublicKeyHex: "b".repeat(64),
      senderPublicKeyHex: "a".repeat(64),
      customTags: [["t", "connection-cancel"]],
      profileId: "default",
    });

    expect(urls).toEqual(["ws://localhost:7000"]);
    expect(urls).not.toContain("wss://nos.lol");
  });

  it("keeps hybrid union when pool includes WebSocket relays", () => {
    peerRelayEvidenceMocks.getRelayUrls.mockReturnValue(["wss://nos.lol"]);
    nip65Mocks.getWriteRelays.mockReturnValue([]);

    const urls = resolveTargetRelayUrls({
      pool: createPool(["wss://relay.damus.io", "wss://nos.lol"]),
      peerPublicKeyHex: "b".repeat(64),
      senderPublicKeyHex: "a".repeat(64),
    });

    expect(urls).toContain("wss://nos.lol");
    expect(urls).toContain("wss://relay.damus.io");
  });

  it("S1: omits localhost from DM targets when an open remote exists", () => {
    peerRelayEvidenceMocks.getRelayUrls.mockReturnValue([]);
    nip65Mocks.getWriteRelays.mockReturnValue([]);

    const urls = resolveTargetRelayUrls({
      pool: createPool(
        ["wss://relay.damus.io", "ws://localhost:7000"],
        { openRelayUrls: ["wss://relay.damus.io", "ws://localhost:7000"] },
      ),
      peerPublicKeyHex: "b".repeat(64),
      senderPublicKeyHex: "a".repeat(64),
    });

    expect(urls).toContain("wss://relay.damus.io");
    expect(urls).not.toContain("ws://localhost:7000");
  });
});

describe("shouldPrimeDmDeliveryFallbackRelays / subscribeToIncomingDMs (H6b)", () => {
  beforeEach(() => {
    exclusiveIntentMocks.readExclusiveTransportPresetIntent.mockReset();
    exclusiveIntentMocks.readExclusiveTransportPresetIntent.mockReturnValue(null);
  });

  it("does not prime public fallbacks for Soft L3 exclusive pool", () => {
    expect(shouldPrimeDmDeliveryFallbackRelays({
      pool: createPool(["ws://localhost:7000"]),
    })).toBe(false);
  });

  it("does not prime public fallbacks for HTTP-only mesh", () => {
    expect(shouldPrimeDmDeliveryFallbackRelays({
      pool: createPool(["http://127.0.0.1:8788"]),
    })).toBe(false);
  });

  it("does not prime when sticky exclusive Soft L3 intent is set", () => {
    exclusiveIntentMocks.readExclusiveTransportPresetIntent.mockReturnValue("local_dev_mesh");
    expect(shouldPrimeDmDeliveryFallbackRelays({
      pool: createPool(["ws://localhost:7000", "wss://nos.lol"]),
      profileId: "default",
    })).toBe(false);
  });

  it("primes public fallbacks for hybrid public pools", () => {
    expect(shouldPrimeDmDeliveryFallbackRelays({
      pool: createPool(["wss://relay.damus.io", "wss://nos.lol"]),
    })).toBe(true);
  });

  it("subscribeToIncomingDMs skips addTransientRelay under Soft L3 exclusive", () => {
    const addTransientRelay = vi.fn();
    const pool = createPool(["ws://localhost:7000"]);
    pool.addTransientRelay = addTransientRelay;
    pool.subscribe = () => "mesh-sub-test";

    subscribeToIncomingDMs({
      pool,
      myPublicKeyHex: "a".repeat(64),
      onEvent: () => undefined,
    });

    expect(addTransientRelay).not.toHaveBeenCalled();
  });

  it("subscribeToIncomingDMs primes fallbacks on hybrid public pools", () => {
    const addTransientRelay = vi.fn();
    const pool = createPool(["wss://relay.damus.io"]);
    pool.addTransientRelay = addTransientRelay;
    pool.subscribe = () => "mesh-sub-test";

    subscribeToIncomingDMs({
      pool,
      myPublicKeyHex: "a".repeat(64),
      onEvent: () => undefined,
    });

    expect(addTransientRelay).toHaveBeenCalled();
    expect(addTransientRelay.mock.calls.some((call) => String(call[0]).includes("nos.lol"))).toBe(true);
  });
});

describe("publishToRelays", () => {
  it("D2: last-resort sendToOpen does not claim publish success without OK", async () => {
    const sendToOpen = vi.fn();
    const pool = createPool(["wss://relay1.example.com"], {
      openRelayUrls: ["wss://relay1.example.com"],
    });
    pool.sendToOpen = sendToOpen;
    // Force last resort: no publishToUrls / publishToAll
    pool.publishToUrls = undefined;
    pool.publishToAll = undefined;

    const result = await publishToRelays({
      pool,
      signedEvent: {
        id: "evt1",
        kind: 4,
        pubkey: "a".repeat(64),
        created_at: 1,
        tags: [],
        content: "x",
        sig: "sig",
      } as any,
      targetRelayUrls: ["wss://relay1.example.com"],
    });

    expect(sendToOpen).toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.successCount).toBe(0);
    expect(result.outcomes.every((o) => o.success === false)).toBe(true);
    expect(result.outcomes[0]?.error).toBe("no_relay_ok_ack");
  });

  it("D1: retries open local workspace relay when S1 remote scoped publish fails", async () => {
    const publishToUrls = vi.fn(async (urls: ReadonlyArray<string>) => {
      if (urls.some((url) => /localhost:7000/i.test(url))) {
        return {
          success: true,
          successCount: 1,
          totalRelays: 1,
          results: [{ relayUrl: "ws://localhost:7000", success: true }],
        };
      }
      return {
        success: false,
        successCount: 0,
        totalRelays: urls.length,
        results: urls.map((relayUrl) => ({ relayUrl, success: false, error: "timeout" })),
        overallError: "timeout waiting for ok response",
      };
    });
    const pool = createPool(
      ["wss://nos.lol", "ws://localhost:7000"],
      { openRelayUrls: ["wss://nos.lol", "ws://localhost:7000"] },
    );
    pool.publishToUrls = publishToUrls;
    pool.publishToAll = vi.fn(async () => ({
      success: false,
      successCount: 0,
      totalRelays: 0,
      results: [],
    }));

    const result = await publishToRelays({
      pool,
      signedEvent: {
        id: "evt-local-fallback",
        kind: 4,
        pubkey: "a".repeat(64),
        created_at: 1,
        tags: [],
        content: "marker",
        sig: "sig",
      } as any,
      // S1-shaped targets: remotes only
      targetRelayUrls: ["wss://nos.lol"],
    });

    expect(result.success).toBe(true);
    expect(publishToUrls).toHaveBeenCalledTimes(2);
    expect(publishToUrls.mock.calls[0]?.[0]).toEqual(["wss://nos.lol"]);
    expect(publishToUrls.mock.calls[1]?.[0]).toEqual(["ws://localhost:7000"]);
  });
});
