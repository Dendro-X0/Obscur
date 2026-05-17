import { beforeEach, describe, expect, it, vi } from "vitest";
import { processOfflineQueue } from "./dm-queue-orchestrator";
import { offlineQueueManager } from "../lib/offline-queue-manager";

vi.mock("./outgoing-dm-publisher", () => ({
  publishQueuedOutgoingMessage: vi.fn(),
}));

vi.mock("../services/delivery-troubleshooting-reporter", () => ({
  reportSenderDeliveryIssue: vi.fn(),
}));

vi.mock("../services/delivery-diagnostics-store", () => ({
  deliveryDiagnosticsStore: {
    markPublish: vi.fn(),
  },
}));

import { publishQueuedOutgoingMessage } from "./outgoing-dm-publisher";
import { reportSenderDeliveryIssue } from "../services/delivery-troubleshooting-reporter";
import { deliveryDiagnosticsStore } from "../services/delivery-diagnostics-store";

const createQueuedMessage = () => ({
  id: "msg-1",
  conversationId: "conversation-a",
  content: "hello",
  recipientPubkey: "b".repeat(64) as any,
  targetRelayUrls: ["wss://relay-a.example", "wss://relay-b.example"],
  createdAt: new Date("2026-03-13T00:00:00.000Z"),
  retryCount: 2,
  nextRetryAt: new Date("2026-03-13T00:00:05.000Z"),
  signedEvent: {
    id: "event-queued-1",
    pubkey: "a".repeat(64),
    kind: 4,
    created_at: Math.floor(Date.now() / 1000),
    tags: [["p", "b".repeat(64)]],
    content: "ciphertext",
    sig: "f".repeat(128),
  },
});

describe("dm-queue-orchestrator delivery troubleshooting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(offlineQueueManager, "manualProcessQueue").mockImplementation(
      async (getQueuedMessages, sendMessage) => {
        const queued = await getQueuedMessages();
        for (const message of queued) {
          await sendMessage(message);
        }
        return {
          processed: queued.length,
          succeeded: 0,
          retryScheduled: queued.length,
          failed: 0,
          errors: [],
        };
      }
    );
  });

  it("reports retry-scheduled queued send failures in dev diagnostics", async () => {
    vi.mocked(publishQueuedOutgoingMessage).mockResolvedValue({
      status: "retry_scheduled",
      reasonCode: "quorum_not_met",
      error: "Durable relay evidence not met (1/2).",
      nextRetryAtUnixMs: 1_778_000_000_000,
      relayOutcome: {
        successCount: 1,
        totalRelays: 2,
        metQuorum: false,
      },
    });

    const queuedMessage = createQueuedMessage();
    const messageQueue = {
      getQueuedMessages: vi.fn(async () => [queuedMessage]),
      removeFromQueue: vi.fn(async () => undefined),
    } as any;

    await processOfflineQueue({
      messageQueue,
      pool: { connections: [], sendToOpen: vi.fn() } as any,
      setState: vi.fn(),
    });

    expect(vi.mocked(deliveryDiagnosticsStore.markPublish)).toHaveBeenCalledWith(
      expect.objectContaining({
        peerPublicKeyHex: queuedMessage.recipientPubkey,
        eventId: queuedMessage.signedEvent.id,
        deliveryStatus: "queued_retrying",
        success: false,
        reasonCode: "quorum_not_met",
      })
    );
    expect(vi.mocked(reportSenderDeliveryIssue)).toHaveBeenCalledWith(
      expect.objectContaining({
        attemptPhase: "queue_retry",
        senderPublicKeyHex: queuedMessage.signedEvent.pubkey,
        recipientPublicKeyHex: queuedMessage.recipientPubkey,
        messageId: queuedMessage.signedEvent.id,
        deliveryStatus: "queued_retrying",
        failureReason: "quorum_not_met",
      })
    );
  });

  it("reports terminal queued send failures as sender delivery failures", async () => {
    vi.mocked(publishQueuedOutgoingMessage).mockResolvedValue({
      status: "terminal_failed",
      reasonCode: "max_retries_exceeded",
      error: "Queue retry budget exhausted",
      relayOutcome: {
        successCount: 0,
        totalRelays: 2,
        metQuorum: false,
      },
    });

    const queuedMessage = createQueuedMessage();
    const messageQueue = {
      getQueuedMessages: vi.fn(async () => [queuedMessage]),
      removeFromQueue: vi.fn(async () => undefined),
    } as any;

    await processOfflineQueue({
      messageQueue,
      pool: { connections: [], sendToOpen: vi.fn() } as any,
      setState: vi.fn(),
    });

    expect(vi.mocked(deliveryDiagnosticsStore.markPublish)).toHaveBeenCalledWith(
      expect.objectContaining({
        peerPublicKeyHex: queuedMessage.recipientPubkey,
        eventId: queuedMessage.signedEvent.id,
        deliveryStatus: "failed",
        success: false,
        reasonCode: "max_retries_exceeded",
      })
    );
    expect(vi.mocked(reportSenderDeliveryIssue)).toHaveBeenCalledWith(
      expect.objectContaining({
        attemptPhase: "queue_retry",
        senderPublicKeyHex: queuedMessage.signedEvent.pubkey,
        recipientPublicKeyHex: queuedMessage.recipientPubkey,
        messageId: queuedMessage.signedEvent.id,
        deliveryStatus: "failed",
        failureReason: "unknown",
      })
    );
  });
});
