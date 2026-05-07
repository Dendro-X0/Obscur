import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendDm, dmSendPipelineInternals } from "./dm-send-pipeline";
import type { RelayPoolContract } from "./dm-controller-types";

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
    connectedRelayCount: 2,
    writableRelayCount: 2,
  })),
  ...overrides,
});

describe("dm-send-pipeline", () => {
  beforeEach(() => {
    dmSendPipelineInternals.inflight.clear();
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
