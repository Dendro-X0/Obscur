import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  isHttpOnlyMeshTransportPool,
  resolveTargetRelayUrls,
} from "./dm-relay-transport";
import type { RelayPoolContract } from "./dm-controller-types";

const nip65Mocks = vi.hoisted(() => ({
  getWriteRelays: vi.fn(() => [] as string[]),
}));

const peerRelayEvidenceMocks = vi.hoisted(() => ({
  getRelayUrls: vi.fn(() => [] as string[]),
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

const createPool = (
  configuredRelayUrls: ReadonlyArray<string>,
): RelayPoolContract => ({
  connections: [],
  sendToOpen: () => undefined,
  subscribeToMessages: () => () => undefined,
  subscribe: () => "sub-test",
  unsubscribe: () => undefined,
  waitForConnection: async () => true,
  getWritableRelaySnapshot: () => ({
    atUnixMs: Date.now(),
    configuredRelayUrls: [...configuredRelayUrls],
    writableRelayUrls: [...configuredRelayUrls],
    totalRelayCount: configuredRelayUrls.length,
    connectedRelayCount: configuredRelayUrls.length,
    writableRelayCount: configuredRelayUrls.length,
  }),
});

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

describe("resolveTargetRelayUrls", () => {
  beforeEach(() => {
    nip65Mocks.getWriteRelays.mockReset();
    nip65Mocks.getWriteRelays.mockReturnValue([]);
    peerRelayEvidenceMocks.getRelayUrls.mockReset();
    peerRelayEvidenceMocks.getRelayUrls.mockReturnValue([]);
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
});
