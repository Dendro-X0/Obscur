import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendDm, dmSendPipelineInternals } from "./dm-send-pipeline";
import type { RelayPoolContract } from "./dm-controller-types";

const nip65Mocks = vi.hoisted(() => ({
  getWriteRelays: vi.fn(() => [] as string[]),
}));

const peerRelayEvidenceMocks = vi.hoisted(() => ({
  getRelayUrls: vi.fn(() => [] as string[]),
}));

vi.mock("@/app/features/crypto/crypto-service", () => ({
  cryptoService: {
    encryptDM: vi.fn(async (plaintext: string) => `encrypted:${plaintext}`),
    signEvent: vi.fn(async (unsigned: any) => ({
      ...unsigned,
      id: "signed-event-id-" + unsigned.content.slice(0, 8),
      sig: "sig-mock",
    })),
    encryptGiftWrap: vi.fn(async (rumor: any) => ({
      id: "giftwrap-id",
      kind: 1059,
      pubkey: "wrapper-pubkey",
      created_at: rumor.created_at,
      content: `wrapped:${rumor.content}`,
      tags: [["p", "recipient"]],
      sig: "giftwrap-sig",
    })),
  },
}));

vi.mock("@/app/features/relays/utils/nip65-service", () => ({
  nip65Service: {
    getWriteRelays: nip65Mocks.getWriteRelays,
  },
}));

vi.mock("../../services/peer-relay-evidence-store", () => ({
  peerRelayEvidenceStore: {
    getRelayUrls: peerRelayEvidenceMocks.getRelayUrls,
    subscribe: vi.fn(() => () => {}),
  },
}));

const createMockPool = (overrides?: Partial<RelayPoolContract>): RelayPoolContract => ({
  connections: [
    { url: "wss://relay1.example.com", status: "open" },
    { url: "wss://relay2.example.com", status: "open" },
  ],
  sendToOpen: vi.fn(),
  publishToUrls: vi.fn(async () => ({
    success: true,
    successCount: 2,
    totalRelays: 2,
    results: [
      { relayUrl: "wss://relay1.example.com", success: true },
      { relayUrl: "wss://relay2.example.com", success: true },
    ],
  })),
  publishToAll: vi.fn(async () => ({
    success: true,
    successCount: 2,
    totalRelays: 2,
    results: [
      { relayUrl: "wss://relay1.example.com", success: true },
      { relayUrl: "wss://relay2.example.com", success: true },
    ],
  })),
  subscribeToMessages: vi.fn(() => () => {}),
  subscribe: vi.fn(() => "sub-id"),
  unsubscribe: vi.fn(),
  waitForConnection: vi.fn(async () => true),
  getWritableRelaySnapshot: vi.fn(() => ({
    writableRelayUrls: ["wss://relay1.example.com", "wss://relay2.example.com"],
    configuredRelayUrls: ["wss://relay1.example.com", "wss://relay2.example.com"],
    connectedRelayCount: 2,
    writableRelayCount: 2,
  })),
  ...overrides,
});

describe("dm-send-pipeline", () => {
  beforeEach(() => {
    dmSendPipelineInternals.inflight.clear();
    nip65Mocks.getWriteRelays.mockReset();
    nip65Mocks.getWriteRelays.mockReturnValue([]);
    peerRelayEvidenceMocks.getRelayUrls.mockReset();
    peerRelayEvidenceMocks.getRelayUrls.mockReturnValue([]);
  });

  it("sends a DM and returns success with relay results", async () => {
    const pool = createMockPool();

    const result = await sendDm({
      pool,
      senderPublicKeyHex: "a".repeat(64),
      senderPrivateKeyHex: "b".repeat(64) as any,
      recipientPublicKeyHex: "c".repeat(64),
      plaintext: "hello world",
    });

    expect(result.success).toBe(true);
    expect(result.deliveryStatus).toBe("sent_quorum");
    expect(result.messageId).toBeTruthy();
    expect(result.relayResults.length).toBeGreaterThan(0);
    expect(result.relayResults.every(r => r.success)).toBe(true);
  });

  it("prevents double-send of the same message", async () => {
    const pool = createMockPool({
      publishToUrls: vi.fn(async () => {
        // Simulate slow publish
        await new Promise(r => setTimeout(r, 50));
        return {
          success: true,
          successCount: 1,
          totalRelays: 1,
          results: [{ relayUrl: "wss://relay1.example.com", success: true }],
        };
      }),
    });

    const params = {
      pool,
      senderPublicKeyHex: "a".repeat(64),
      senderPrivateKeyHex: "b".repeat(64) as any,
      recipientPublicKeyHex: "c".repeat(64),
      plaintext: "duplicate test",
    };

    // Fire two sends simultaneously
    const [result1, result2] = await Promise.all([
      sendDm(params),
      sendDm(params),
    ]);

    // One should succeed, one should be deduped
    const successCount = [result1, result2].filter(r => r.success).length;
    const dedupCount = [result1, result2].filter(r => r.error === "Duplicate send suppressed").length;
    expect(successCount).toBe(1);
    expect(dedupCount).toBe(1);
  });

  it("returns failed when all relays reject", async () => {
    const pool = createMockPool({
      connections: [],
      publishToUrls: vi.fn(async () => ({
        success: false,
        successCount: 0,
        totalRelays: 2,
        results: [
          { relayUrl: "wss://relay1.example.com", success: false, error: "rejected" },
          { relayUrl: "wss://relay2.example.com", success: false, error: "rejected" },
        ],
      })),
      publishToAll: vi.fn(async () => ({
        success: false,
        successCount: 0,
        totalRelays: 2,
        results: [
          { relayUrl: "wss://relay1.example.com", success: false, error: "rejected" },
          { relayUrl: "wss://relay2.example.com", success: false, error: "rejected" },
        ],
      })),
    });

    const result = await sendDm({
      pool,
      senderPublicKeyHex: "a".repeat(64),
      senderPrivateKeyHex: "b".repeat(64) as any,
      recipientPublicKeyHex: "c".repeat(64),
      plaintext: "will fail",
    });

    expect(result.success).toBe(false);
    expect(result.deliveryStatus).toBe("failed");
  });

  it("falls back to publishToAll when publishToUrls is unavailable", async () => {
    const publishToAll = vi.fn(async () => ({
      success: true,
      successCount: 1,
      totalRelays: 1,
      results: [{ relayUrl: "wss://relay1.example.com", success: true }],
    }));

    const pool = createMockPool({
      publishToUrls: undefined,
      publishToAll,
    });

    const result = await sendDm({
      pool,
      senderPublicKeyHex: "a".repeat(64),
      senderPrivateKeyHex: "b".repeat(64) as any,
      recipientPublicKeyHex: "c".repeat(64),
      plaintext: "fallback test",
    });

    expect(result.success).toBe(true);
    expect(publishToAll).toHaveBeenCalled();
  });

  it("unions message-delete publish with sender relays when recipient-facing evidence exists", async () => {
    const publishToUrls = vi.fn(async (_urls: ReadonlyArray<string>) => ({
      success: true,
      successCount: 1,
      totalRelays: 1,
      results: [{ relayUrl: "wss://recipient-write.example", success: true }],
    }));
    nip65Mocks.getWriteRelays.mockReturnValue(["wss://recipient-write.example"]);
    peerRelayEvidenceMocks.getRelayUrls.mockReturnValue(["wss://recipient-inbound.example"]);

    const pool = createMockPool({
      publishToUrls,
      getWritableRelaySnapshot: vi.fn((scopedRelayUrls?: ReadonlyArray<string>) => ({
        writableRelayUrls: scopedRelayUrls?.includes("wss://recipient-write.example")
          ? ["wss://recipient-write.example"]
          : ["wss://relay1.example.com", "wss://relay2.example.com"],
      })),
    });

    const result = await sendDm({
      pool,
      senderPublicKeyHex: "a".repeat(64),
      senderPrivateKeyHex: "b".repeat(64) as any,
      recipientPublicKeyHex: "c".repeat(64),
      plaintext: "__dweb_cmd__delete:{}",
      customTags: [["t", "message-delete"]],
    });

    expect(result.success).toBe(true);
    expect(publishToUrls).toHaveBeenCalled();
    const publishedUrls = publishToUrls.mock.calls[0]![0] as ReadonlyArray<string>;
    expect(publishedUrls).toEqual(
      expect.arrayContaining([
        "wss://recipient-write.example",
        "wss://recipient-inbound.example",
        "wss://relay1.example.com",
        "wss://relay2.example.com",
      ]),
    );
    expect(publishedUrls).toHaveLength(4);
  });

  it("includes well-known fallback relays when peer relay evidence is unknown", async () => {
    // Both nip65 and inbound evidence are empty — simulates a brand-new contact
    nip65Mocks.getWriteRelays.mockReturnValue([]);
    peerRelayEvidenceMocks.getRelayUrls.mockReturnValue([]);

    const publishToUrls = vi.fn(async (urls: ReadonlyArray<string>) => ({
      success: true,
      successCount: urls.length,
      totalRelays: urls.length,
      results: urls.map(u => ({ relayUrl: u, success: true })),
    }));

    // getWritableRelaySnapshot always returns empty — forces the final fallback
    // branch in resolveTargetRelayUrls to include DM_DELIVERY_FALLBACK_RELAYS.
    const pool = createMockPool({
      connections: [{ url: "wss://my-relay.example.com", status: "open" }],
      publishToUrls,
      getWritableRelaySnapshot: vi.fn(() => ({
        writableRelayUrls: [] as string[],
        connectedRelayCount: 0,
        writableRelayCount: 0,
      })),
    });

    await sendDm({
      pool,
      senderPublicKeyHex: "a".repeat(64),
      senderPrivateKeyHex: "b".repeat(64) as any,
      recipientPublicKeyHex: "c".repeat(64),
      plaintext: "hello unknown peer",
    });

    expect(publishToUrls).toHaveBeenCalled();
    const calledUrls: ReadonlyArray<string> = publishToUrls.mock.calls[0][0];
    // Must include at least one well-known fallback so the recipient can receive
    const fallbackRelays = ["wss://relay.damus.io", "wss://nos.lol", "wss://relay.primal.net"];
    expect(fallbackRelays.some(r => calledUrls.includes(r))).toBe(true);
  });

  it("reports failed confirmation with reason when no relays confirm", async () => {
    const onConfirmed = vi.fn();
    const pool = createMockPool({
      connections: [],
      publishToUrls: vi.fn(async () => ({
        success: false,
        successCount: 0,
        totalRelays: 0,
        results: [],
        overallError: "no writable relays",
      })),
      publishToAll: vi.fn(async () => ({
        success: false,
        successCount: 0,
        totalRelays: 0,
        results: [],
        overallError: "no writable relays",
      })),
      sendToOpen: vi.fn(),
    });

    const immediate = await sendDm({
      pool,
      senderPublicKeyHex: "a".repeat(64),
      senderPrivateKeyHex: "b".repeat(64) as any,
      recipientPublicKeyHex: "c".repeat(64),
      plaintext: "async failure",
      onConfirmed,
    });

    expect(immediate.success).toBe(false);
    await vi.waitFor(() => {
      expect(onConfirmed).toHaveBeenCalled();
    });
    const confirmation = onConfirmed.mock.calls[0]![0];
    expect(confirmation.success).toBe(false);
    expect(confirmation.reasonCode).toBe("no_writable_relays");
  });

  it("clears inflight guard even on error", async () => {
    const pool = createMockPool({
      connections: [],
      publishToUrls: vi.fn(async () => { throw new Error("network error"); }),
      publishToAll: vi.fn(async () => { throw new Error("network error"); }),
      sendToOpen: vi.fn(() => { throw new Error("no connections"); }),
    });

    const result = await sendDm({
      pool,
      senderPublicKeyHex: "a".repeat(64),
      senderPrivateKeyHex: "b".repeat(64) as any,
      recipientPublicKeyHex: "c".repeat(64),
      plaintext: "error test",
    });

    expect(result.success).toBe(false);
    expect(dmSendPipelineInternals.inflight.size).toBe(0);
  });
});
