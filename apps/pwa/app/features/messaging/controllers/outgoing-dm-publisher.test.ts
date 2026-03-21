import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NostrEvent } from "@dweb/nostr/nostr-event";
import type { Message, OutgoingMessage } from "../lib/message-queue";
import {
  MIN_QUEUE_RETRY_DELAY_MS,
  outgoingDmPublisherInternals,
  publishOutgoingDm,
  publishQueuedOutgoingMessage,
} from "./outgoing-dm-publisher";
import * as appEventLogger from "@/app/shared/log-app-event";
import { getV090RolloutPolicy } from "@/app/features/settings/services/v090-rollout-policy";
import { protocolCoreAdapter } from "@/app/features/runtime/protocol-core-adapter";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { retryManager } from "../lib/retry-manager";

vi.mock("@/app/features/settings/services/privacy-settings-service", () => ({
  PrivacySettingsService: {
    getSettings: vi.fn(() => ({})),
  },
}));

vi.mock("@/app/features/settings/services/v090-rollout-policy", () => ({
  getV090RolloutPolicy: vi.fn(() => ({
    stabilityModeEnabled: false,
    deterministicDiscoveryEnabled: false,
    protocolCoreEnabled: false,
    x3dhRatchetEnabled: false,
  })),
}));

vi.mock("@/app/features/runtime/protocol-core-adapter", () => ({
  protocolCoreAdapter: {
    publishWithQuorum: vi.fn(),
  },
}));

vi.mock("@/app/features/runtime/runtime-capabilities", () => ({
  hasNativeRuntime: vi.fn(() => true),
}));

const senderPubkey = "sender-pubkey" as any;
const recipientPubkey = "recipient-pubkey" as any;
const senderPrivateKeyHex = "sender-private" as any;

const buildSignedEvent = (id: string): NostrEvent => ({
  id,
  kind: 4,
  created_at: 123,
  pubkey: senderPubkey,
  sig: "sig",
  content: "ciphertext",
  tags: [["p", recipientPubkey]],
});

const initialMessage = (): Message => ({
  id: "msg-1",
  conversationId: "conv-1",
  content: "hello",
  kind: "user",
  timestamp: new Date(),
  isOutgoing: true,
  status: "sending",
  eventId: "evt-1",
  senderPubkey,
  recipientPubkey,
  encryptedContent: "ciphertext",
});

describe("outgoing-dm-publisher protocol routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasNativeRuntime).mockReturnValue(true);
  });

  it("uses protocol publish report when protocol core is enabled", async () => {
    vi.mocked(getV090RolloutPolicy).mockReturnValue({
      stabilityModeEnabled: false,
      deterministicDiscoveryEnabled: false,
      protocolCoreEnabled: true,
      x3dhRatchetEnabled: false,
    });
    vi.mocked(protocolCoreAdapter.publishWithQuorum).mockResolvedValue({
      ok: true,
      value: {
        successCount: 1,
        totalRelays: 2,
        metQuorum: false,
        failures: [{ relayUrl: "wss://relay-2.example", error: "timeout" }],
        elapsedMs: 44,
      },
    });

    const pool = {
      sendToOpen: vi.fn(),
      publishToAll: vi.fn(async () => ({
        success: true,
        successCount: 2,
        totalRelays: 2,
        results: [],
      })),
    };

    const result = await publishOutgoingDm({
      pool,
      openRelays: [{ url: "wss://relay-1.example" }, { url: "wss://relay-2.example" }],
      messageQueue: null,
      initialMessage: initialMessage(),
      build: {
        format: "nip04",
        signedEvent: buildSignedEvent("evt-1"),
        encryptedContent: "ciphertext",
      },
      plaintext: "hello",
      recipientPubkey,
      senderPubkey,
      senderPrivateKeyHex,
      createdAtUnixSeconds: 123,
      tags: [["p", recipientPubkey]],
    });

    expect(protocolCoreAdapter.publishWithQuorum).toHaveBeenCalledTimes(1);
    expect(pool.publishToAll).not.toHaveBeenCalled();
    expect(result.publishResult.success).toBe(false);
    expect(result.publishResult.metQuorum).toBe(false);
    expect(result.publishResult.successCount).toBe(1);
    expect(result.publishResult.results).toEqual([
      { relayUrl: "wss://relay-1.example", success: true, error: undefined },
      { relayUrl: "wss://relay-2.example", success: false, error: "timeout" },
    ]);
  });

  it("uses legacy publish owner path when runtime is non-native", async () => {
    vi.mocked(hasNativeRuntime).mockReturnValue(false);
    vi.mocked(getV090RolloutPolicy).mockReturnValue({
      stabilityModeEnabled: false,
      deterministicDiscoveryEnabled: false,
      protocolCoreEnabled: true,
      x3dhRatchetEnabled: false,
    });

    const pool = {
      sendToOpen: vi.fn(),
      publishToAll: vi.fn(async () => ({
        success: true,
        successCount: 2,
        totalRelays: 2,
        results: [
          { relayUrl: "wss://relay-1.example", success: true },
          { relayUrl: "wss://relay-2.example", success: true },
        ],
      })),
    };

    const result = await publishOutgoingDm({
      pool,
      openRelays: [{ url: "wss://relay-1.example" }, { url: "wss://relay-2.example" }],
      messageQueue: null,
      initialMessage: initialMessage(),
      build: {
        format: "nip04",
        signedEvent: buildSignedEvent("evt-legacy-runtime"),
        encryptedContent: "ciphertext",
      },
      plaintext: "hello",
      recipientPubkey,
      senderPubkey,
      senderPrivateKeyHex,
      createdAtUnixSeconds: 123,
      tags: [["p", recipientPubkey]],
    });

    expect(protocolCoreAdapter.publishWithQuorum).not.toHaveBeenCalled();
    expect(pool.publishToAll).toHaveBeenCalledTimes(1);
    expect(result.publishResult.success).toBe(true);
  });

  it("does not fall back to legacy publish when protocol owner path fails", async () => {
    vi.mocked(getV090RolloutPolicy).mockReturnValue({
      stabilityModeEnabled: false,
      deterministicDiscoveryEnabled: false,
      protocolCoreEnabled: true,
      x3dhRatchetEnabled: false,
    });
    vi.mocked(protocolCoreAdapter.publishWithQuorum).mockResolvedValue({
      ok: false,
      reason: "failed",
      message: "protocol runtime unavailable",
    });

    const pool = {
      sendToOpen: vi.fn(),
      publishToAll: vi.fn(async () => ({
        success: true,
        successCount: 2,
        totalRelays: 2,
        results: [
          { relayUrl: "wss://relay-1.example", success: true },
          { relayUrl: "wss://relay-2.example", success: true },
        ],
      })),
    };

    const result = await publishOutgoingDm({
      pool,
      openRelays: [{ url: "wss://relay-1.example" }, { url: "wss://relay-2.example" }],
      messageQueue: null,
      initialMessage: initialMessage(),
      build: {
        format: "nip04",
        signedEvent: buildSignedEvent("evt-2"),
        encryptedContent: "ciphertext",
      },
      plaintext: "hello",
      recipientPubkey,
      senderPubkey,
      senderPrivateKeyHex,
      createdAtUnixSeconds: 123,
      tags: [["p", recipientPubkey]],
    });

    expect(protocolCoreAdapter.publishWithQuorum).toHaveBeenCalledTimes(1);
    expect(pool.publishToAll).not.toHaveBeenCalled();
    expect(result.publishResult.success).toBe(false);
    expect(result.publishResult.reasonCode).toBe("quorum_not_met");
  });

  it("uses scoped relay publishing in legacy owner mode when publishToUrls is available", async () => {
    vi.mocked(getV090RolloutPolicy).mockReturnValue({
      stabilityModeEnabled: false,
      deterministicDiscoveryEnabled: false,
      protocolCoreEnabled: false,
      x3dhRatchetEnabled: false,
    });
    vi.mocked(protocolCoreAdapter.publishWithQuorum).mockResolvedValue({
      ok: true,
      value: {
        successCount: 2,
        totalRelays: 2,
        metQuorum: true,
        failures: [],
        elapsedMs: 14,
      },
    });

    const publishToUrls = vi.fn(async () => ({
      success: true,
      successCount: 2,
      totalRelays: 2,
      results: [
        { relayUrl: "wss://recipient-1.example", success: true },
        { relayUrl: "wss://recipient-2.example", success: true },
      ],
    }));

    const result = await publishOutgoingDm({
      pool: {
        sendToOpen: vi.fn(),
        publishToUrls,
        publishToAll: vi.fn(),
      },
      openRelays: [{ url: "wss://sender-1.example" }],
      targetRelayUrls: ["wss://recipient-1.example", "wss://recipient-2.example"],
      messageQueue: null,
      initialMessage: initialMessage(),
      build: {
        format: "nip04",
        signedEvent: buildSignedEvent("evt-scoped"),
        encryptedContent: "ciphertext",
      },
      plaintext: "hello",
      recipientPubkey,
      senderPubkey,
      senderPrivateKeyHex,
      createdAtUnixSeconds: 123,
      tags: [["p", recipientPubkey]],
    });

    expect(publishToUrls).toHaveBeenCalledWith(
      ["wss://recipient-1.example", "wss://recipient-2.example"],
      JSON.stringify(["EVENT", buildSignedEvent("evt-scoped")]),
    );
    expect(protocolCoreAdapter.publishWithQuorum).not.toHaveBeenCalled();
    expect(result.publishResult.success).toBe(true);
    expect(result.publishResult.successCount).toBe(2);
  });

  it("queues retry when scoped publish has only one success across three recipient relays", async () => {
    const updateMessageStatus = vi.fn(async () => undefined);
    const queueOutgoingMessage = vi.fn(async () => undefined);
    const publishToUrls = vi
      .fn()
      .mockResolvedValueOnce({
        success: true,
        successCount: 1,
        totalRelays: 3,
        metQuorum: true,
        quorumRequired: 1,
        results: [
          { relayUrl: "wss://recipient-1.example", success: true },
          { relayUrl: "wss://recipient-2.example", success: false, error: "timeout" },
          { relayUrl: "wss://recipient-3.example", success: false, error: "timeout" },
        ],
      })
      .mockResolvedValueOnce({
        success: false,
        successCount: 0,
        totalRelays: 2,
        metQuorum: false,
        quorumRequired: 1,
        results: [
          { relayUrl: "wss://recipient-2.example", success: false, error: "503" },
          { relayUrl: "wss://recipient-3.example", success: false, error: "503" },
        ],
      });

    const result = await publishOutgoingDm({
      pool: {
        sendToOpen: vi.fn(),
        publishToUrls,
        publishToAll: vi.fn(),
      },
      openRelays: [{ url: "wss://sender-1.example" }],
      targetRelayUrls: [
        "wss://recipient-1.example",
        "wss://recipient-2.example",
        "wss://recipient-3.example",
      ],
      messageQueue: { updateMessageStatus, queueOutgoingMessage } as any,
      initialMessage: initialMessage(),
      build: {
        format: "nip04",
        signedEvent: buildSignedEvent("evt-durable-threshold"),
        encryptedContent: "ciphertext",
      },
      plaintext: "hello",
      recipientPubkey,
      senderPubkey,
      senderPrivateKeyHex,
      createdAtUnixSeconds: 123,
      tags: [["p", recipientPubkey]],
    });

    expect(publishToUrls).toHaveBeenCalledTimes(2);
    expect(result.publishResult.success).toBe(false);
    expect(result.publishResult.successCount).toBe(1);
    expect(result.publishResult.reasonCode).toBe("relay_degraded");
    expect(result.finalMessage.status).toBe("queued");
    expect(updateMessageStatus).toHaveBeenLastCalledWith("msg-1", "queued");
    expect(queueOutgoingMessage).toHaveBeenCalledWith(expect.objectContaining({
      id: "msg-1",
      retryCount: 0,
    }));
  });

  it("does not claim success when only non-deterministic sendToOpen exists", async () => {
    const logSpy = vi.spyOn(appEventLogger, "logAppEvent");
    const updateMessageStatus = vi.fn(async () => undefined);
    const queueOutgoingMessage = vi.fn(async () => undefined);
    const result = await publishOutgoingDm({
      pool: {
        sendToOpen: vi.fn(),
      } as any,
      openRelays: [{ url: "wss://relay-1.example" }],
      messageQueue: { updateMessageStatus, queueOutgoingMessage } as any,
      initialMessage: initialMessage(),
      build: {
        format: "nip04",
        signedEvent: buildSignedEvent("evt-unsupported"),
        encryptedContent: "ciphertext",
      },
      plaintext: "hello",
      recipientPubkey,
      senderPubkey,
      senderPrivateKeyHex,
      createdAtUnixSeconds: 123,
      tags: [["p", recipientPubkey]],
    });

    expect(result.publishResult.success).toBe(false);
    expect(result.publishResult.reasonCode).toBe("unsupported_runtime");
    expect(result.finalMessage.status).toBe("failed");
    expect(updateMessageStatus).toHaveBeenCalledWith("msg-1", "failed");
    expect(queueOutgoingMessage).not.toHaveBeenCalled();
    const publishResultEvent = logSpy.mock.calls
      .map((call) => call[0])
      .find((event) => event.name === "messaging.transport.publish_result");
    expect(publishResultEvent?.context).toEqual(expect.objectContaining({
      status: "failed",
      reasonCode: "unsupported_runtime",
      metQuorum: false,
      quorumRequired: 1,
      targetRelayCount: 1,
      hasOverallError: true,
    }));
    logSpy.mockRestore();
  });

  it("uses protocol publish for queued retry path", async () => {
    vi.mocked(getV090RolloutPolicy).mockReturnValue({
      stabilityModeEnabled: false,
      deterministicDiscoveryEnabled: false,
      protocolCoreEnabled: true,
      x3dhRatchetEnabled: false,
    });
    vi.mocked(protocolCoreAdapter.publishWithQuorum).mockResolvedValue({
      ok: true,
      value: {
        successCount: 2,
        totalRelays: 2,
        metQuorum: true,
        failures: [],
        elapsedMs: 19,
      },
    });

    const message: OutgoingMessage = {
      id: "queued-1",
      conversationId: "conv-1",
      content: "hello",
      recipientPubkey,
      createdAt: new Date(),
      retryCount: 1,
      nextRetryAt: new Date(),
      signedEvent: buildSignedEvent("evt-queued-1"),
    };

    const updateMessageStatus = vi.fn(async () => undefined);
    const pool = {
      sendToOpen: vi.fn(),
      publishToAll: vi.fn(),
    };
    const outcome = await publishQueuedOutgoingMessage({
      pool,
      messageQueue: { updateMessageStatus } as any,
      message,
      openRelays: [{ url: "wss://relay-1.example" }, { url: "wss://relay-2.example" }],
    });

    expect(outcome.status).toBe("accepted");
    expect(protocolCoreAdapter.publishWithQuorum).toHaveBeenCalledTimes(1);
    expect(updateMessageStatus).toHaveBeenCalledWith("queued-1", "accepted");
    expect(pool.publishToAll).not.toHaveBeenCalled();
  });

  it("uses scoped relay publishing for queued retry path in legacy owner mode", async () => {
    vi.mocked(getV090RolloutPolicy).mockReturnValue({
      stabilityModeEnabled: false,
      deterministicDiscoveryEnabled: false,
      protocolCoreEnabled: false,
      x3dhRatchetEnabled: false,
    });

    const message: OutgoingMessage = {
      id: "queued-scoped",
      conversationId: "conv-1",
      content: "hello",
      recipientPubkey,
      createdAt: new Date(),
      retryCount: 1,
      nextRetryAt: new Date(),
      signedEvent: buildSignedEvent("evt-queued-scoped"),
    };

    const updateMessageStatus = vi.fn(async () => undefined);
    const publishToUrls = vi.fn(async () => ({
      success: true,
      successCount: 2,
      totalRelays: 2,
      results: [
        { relayUrl: "wss://recipient-1.example", success: true },
        { relayUrl: "wss://recipient-2.example", success: true },
      ],
    }));

    const outcome = await publishQueuedOutgoingMessage({
      pool: {
        sendToOpen: vi.fn(),
        publishToUrls,
        publishToAll: vi.fn(),
      },
      messageQueue: { updateMessageStatus } as any,
      message,
      openRelays: [{ url: "wss://recipient-1.example" }, { url: "wss://recipient-2.example" }],
    });

    expect(outcome.status).toBe("accepted");
    expect(publishToUrls).toHaveBeenCalledTimes(1);
    expect(protocolCoreAdapter.publishWithQuorum).not.toHaveBeenCalled();
    expect(updateMessageStatus).toHaveBeenCalledWith("queued-scoped", "accepted");
  });

  it("keeps recipient relay scope for queued retries and schedules retry when durable evidence is missing", async () => {
    const message: OutgoingMessage = {
      id: "queued-durable-scope",
      conversationId: "conv-1",
      content: "hello",
      recipientPubkey,
      targetRelayUrls: [
        "wss://recipient-1.example",
        "wss://recipient-2.example",
        "wss://recipient-3.example",
      ],
      createdAt: new Date(),
      retryCount: 1,
      nextRetryAt: new Date(),
      signedEvent: buildSignedEvent("evt-queued-durable-scope"),
    };

    const updateMessageStatus = vi.fn(async () => undefined);
    const queueOutgoingMessage = vi.fn(async () => undefined);
    const publishToUrls = vi.fn(async () => ({
      success: true,
      successCount: 1,
      totalRelays: 3,
      metQuorum: true,
      quorumRequired: 1,
      results: [
        { relayUrl: "wss://recipient-1.example", success: true },
        { relayUrl: "wss://recipient-2.example", success: false, error: "not_connected" },
        { relayUrl: "wss://recipient-3.example", success: false, error: "timeout" },
      ],
    }));

    const outcome = await publishQueuedOutgoingMessage({
      pool: {
        sendToOpen: vi.fn(),
        publishToUrls,
      },
      messageQueue: { updateMessageStatus, queueOutgoingMessage } as any,
      message,
      openRelays: [{ url: "wss://sender-open-only.example" }],
    });

    expect(publishToUrls).toHaveBeenCalledWith(
      ["wss://recipient-1.example", "wss://recipient-2.example", "wss://recipient-3.example"],
      JSON.stringify(["EVENT", message.signedEvent]),
    );
    expect(outcome.status).toBe("retry_scheduled");
    expect(outcome.reasonCode).toBe("relay_degraded");
    expect(updateMessageStatus).toHaveBeenCalledWith("queued-durable-scope", "queued");
    expect(queueOutgoingMessage).toHaveBeenCalledWith(expect.objectContaining({
      id: "queued-durable-scope",
      targetRelayUrls: [
        "wss://recipient-1.example",
        "wss://recipient-2.example",
        "wss://recipient-3.example",
      ],
      achievedRelayUrls: ["wss://recipient-1.example"],
      retryCount: 2,
    }));
  });

  it("accepts queued message when cumulative relay evidence reaches durable minimum across retries", async () => {
    const message: OutgoingMessage = {
      id: "queued-cumulative",
      conversationId: "conv-1",
      content: "hello",
      recipientPubkey,
      targetRelayUrls: [
        "wss://recipient-1.example",
        "wss://recipient-2.example",
        "wss://recipient-3.example",
      ],
      achievedRelayUrls: ["wss://recipient-1.example"],
      createdAt: new Date(),
      retryCount: 2,
      nextRetryAt: new Date(),
      signedEvent: buildSignedEvent("evt-queued-cumulative"),
    };

    const updateMessageStatus = vi.fn(async () => undefined);
    const queueOutgoingMessage = vi.fn(async () => undefined);
    const publishToUrls = vi.fn(async () => ({
      success: true,
      successCount: 1,
      totalRelays: 3,
      metQuorum: true,
      quorumRequired: 1,
      results: [
        { relayUrl: "wss://recipient-1.example", success: false, error: "duplicate" },
        { relayUrl: "wss://recipient-2.example", success: true },
        { relayUrl: "wss://recipient-3.example", success: false, error: "timeout" },
      ],
    }));

    const outcome = await publishQueuedOutgoingMessage({
      pool: {
        sendToOpen: vi.fn(),
        publishToUrls,
      },
      messageQueue: { updateMessageStatus, queueOutgoingMessage } as any,
      message,
      openRelays: [{ url: "wss://sender-open-only.example" }],
    });

    expect(outcome.status).toBe("accepted");
    expect(outcome.relayOutcome).toEqual({
      successCount: 2,
      totalRelays: 3,
      metQuorum: true,
    });
    expect(updateMessageStatus).toHaveBeenCalledWith("queued-cumulative", "accepted");
    expect(queueOutgoingMessage).not.toHaveBeenCalled();
  });

  it("schedules retry with incremented retry metadata when no writable relays", async () => {
    vi.mocked(getV090RolloutPolicy).mockReturnValue({
      stabilityModeEnabled: false,
      deterministicDiscoveryEnabled: false,
      protocolCoreEnabled: false,
      x3dhRatchetEnabled: false,
    });

    const message: OutgoingMessage = {
      id: "queued-2",
      conversationId: "conv-1",
      content: "hello",
      recipientPubkey,
      createdAt: new Date(),
      retryCount: 1,
      nextRetryAt: new Date(),
      signedEvent: buildSignedEvent("evt-queued-2"),
    };

    const updateMessageStatus = vi.fn(async () => undefined);
    const queueOutgoingMessage = vi.fn(async () => undefined);
    const outcome = await publishQueuedOutgoingMessage({
      pool: {
        sendToOpen: vi.fn(),
        connections: [],
        waitForConnection: async () => false,
      },
      messageQueue: { updateMessageStatus, queueOutgoingMessage } as any,
      message,
      openRelays: [],
    });

    expect(outcome.status).toBe("retry_scheduled");
    expect(outcome.reasonCode).toBe("no_writable_relays");
    expect(queueOutgoingMessage).toHaveBeenCalledTimes(1);
    expect(queueOutgoingMessage).toHaveBeenCalledWith(expect.objectContaining({ retryCount: 2 }));
  });

  it("enforces minimum forward retry time when retry calculation returns immediate timestamp", async () => {
    vi.mocked(getV090RolloutPolicy).mockReturnValue({
      stabilityModeEnabled: false,
      deterministicDiscoveryEnabled: false,
      protocolCoreEnabled: false,
      x3dhRatchetEnabled: false,
    });

    const nowUnixMs = 1_777_000_000_000;
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(nowUnixMs);
    const retrySpy = vi.spyOn(retryManager, "calculateNextRetry").mockReturnValue(new Date(nowUnixMs));

    const message: OutgoingMessage = {
      id: "queued-3",
      conversationId: "conv-1",
      content: "hello",
      recipientPubkey,
      createdAt: new Date(nowUnixMs),
      retryCount: 0,
      nextRetryAt: new Date(nowUnixMs),
      signedEvent: buildSignedEvent("evt-queued-3"),
    };

    const updateMessageStatus = vi.fn(async () => undefined);
    const queueOutgoingMessage = vi.fn(async () => undefined);
    try {
      const outcome = await publishQueuedOutgoingMessage({
        pool: {
          sendToOpen: vi.fn(),
          connections: [],
          waitForConnection: async () => false,
        },
        messageQueue: { updateMessageStatus, queueOutgoingMessage } as any,
        message,
        openRelays: [],
      });

      expect(outcome.status).toBe("retry_scheduled");
      expect(outcome.nextRetryAtUnixMs).toBe(nowUnixMs + MIN_QUEUE_RETRY_DELAY_MS);
      expect(queueOutgoingMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          retryCount: 1,
          nextRetryAt: expect.any(Date),
        })
      );
      const firstQueueCall = queueOutgoingMessage.mock.calls.at(0) as [OutgoingMessage] | undefined;
      expect(firstQueueCall).toBeDefined();
      const queuedPayload = firstQueueCall![0];
      expect(queuedPayload.nextRetryAt.getTime()).toBe(nowUnixMs + MIN_QUEUE_RETRY_DELAY_MS);
    } finally {
      nowSpy.mockRestore();
      retrySpy.mockRestore();
    }
  });

  it("marks queued publish as terminal failure when deterministic publish APIs are unavailable", async () => {
    const message: OutgoingMessage = {
      id: "queued-unsupported",
      conversationId: "conv-1",
      content: "hello",
      recipientPubkey,
      createdAt: new Date(),
      retryCount: 1,
      nextRetryAt: new Date(),
      signedEvent: buildSignedEvent("evt-queued-unsupported"),
    };

    const updateMessageStatus = vi.fn(async () => undefined);
    const queueOutgoingMessage = vi.fn(async () => undefined);
    const outcome = await publishQueuedOutgoingMessage({
      pool: {
        sendToOpen: vi.fn(),
      } as any,
      messageQueue: { updateMessageStatus, queueOutgoingMessage } as any,
      message,
      openRelays: [{ url: "wss://relay-1.example" }],
    });

    expect(outcome.status).toBe("terminal_failed");
    expect(outcome.reasonCode).toBe("unsupported_runtime");
    expect(updateMessageStatus).toHaveBeenCalledWith("queued-unsupported", "failed");
    expect(queueOutgoingMessage).not.toHaveBeenCalled();
  });

  it("schedules retry when partial relay evidence does not meet quorum", async () => {
    const message: OutgoingMessage = {
      id: "queued-partial",
      conversationId: "conv-1",
      content: "hello",
      recipientPubkey,
      targetRelayUrls: ["wss://relay-1.example", "wss://relay-2.example", "wss://relay-3.example"],
      createdAt: new Date(),
      retryCount: 1,
      nextRetryAt: new Date(),
      signedEvent: buildSignedEvent("evt-queued-partial"),
    };

    const updateMessageStatus = vi.fn(async () => undefined);
    const queueOutgoingMessage = vi.fn(async () => undefined);
    const outcome = await publishQueuedOutgoingMessage({
      pool: {
        sendToOpen: vi.fn(),
        publishToAll: vi.fn(async () => ({
          success: false,
          successCount: 1,
          totalRelays: 3,
          metQuorum: false,
          results: [
            { relayUrl: "wss://relay-1.example", success: true },
            { relayUrl: "wss://relay-2.example", success: false, error: "503" },
            { relayUrl: "wss://relay-3.example", success: false, error: "503" },
          ],
        })),
      } as any,
      messageQueue: { updateMessageStatus, queueOutgoingMessage } as any,
      message,
      openRelays: [{ url: "wss://relay-1.example" }, { url: "wss://relay-2.example" }, { url: "wss://relay-3.example" }],
    });

    expect(outcome.status).toBe("retry_scheduled");
    expect(outcome.reasonCode).toBe("relay_degraded");
    expect(outcome.relayOutcome).toEqual({
      successCount: 1,
      totalRelays: 3,
      metQuorum: false,
    });
    expect(updateMessageStatus).toHaveBeenCalledWith("queued-partial", "queued");
    expect(queueOutgoingMessage).toHaveBeenCalledWith(expect.objectContaining({
      id: "queued-partial",
      retryCount: 2,
    }));
  });
});

describe("outgoingDmPublisherInternals", () => {
  it("maps protocol publish report to relay results", () => {
    const mapped = outgoingDmPublisherInternals.mapProtocolPublishReportToRelayPublishResult(
      {
        successCount: 1,
        totalRelays: 3,
        metQuorum: false,
        failures: [{ relayUrl: "wss://r2.example", error: "timeout" }],
        elapsedMs: 55,
      },
      ["wss://r1.example", "wss://r2.example", "wss://r3.example"],
    );

    expect(mapped.successCount).toBe(1);
    expect(mapped.totalRelays).toBe(3);
    expect(mapped.quorumRequired).toBe(2);
    expect(mapped.results).toHaveLength(3);
  });

  it("classifies unsupported runtime as non-retryable", () => {
    expect(outgoingDmPublisherInternals.isRetryablePublishFailure("unsupported_runtime")).toBe(false);
    expect(outgoingDmPublisherInternals.isRetryablePublishFailure("quorum_not_met")).toBe(true);
  });
});
