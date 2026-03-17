import { describe, expect, it, vi } from "vitest";
import { OfflineQueueManager } from "./offline-queue-manager";

vi.mock("./error-handler", () => ({
  errorHandler: {
    canAttemptOperation: vi.fn(() => ({ canAttempt: true })),
    getNetworkState: vi.fn(() => ({ isOnline: true, hasRelayConnection: true })),
    subscribeToNetworkChanges: vi.fn(() => () => undefined),
    handleStorageError: vi.fn(),
  },
}));

describe("OfflineQueueManager", () => {
  it("keeps queued messages when retry is scheduled", async () => {
    const manager = new OfflineQueueManager();
    const removeFromQueue = vi.fn(async () => undefined);

    const result = await manager.processQueue(
      async () => [{
        id: "msg-1",
        conversationId: "c",
        content: "hello",
        recipientPubkey: "a".repeat(64) as any,
        createdAt: new Date(),
        retryCount: 1,
        nextRetryAt: new Date(),
      }],
      async () => ({
        status: "retry_scheduled",
        reasonCode: "quorum_not_met",
        error: "Not enough relays",
      }),
      removeFromQueue
    );

    expect(result.processed).toBe(1);
    expect(result.retryScheduled).toBe(1);
    expect(result.failed).toBe(0);
    expect(removeFromQueue).not.toHaveBeenCalled();
  });

  it("removes entries on accepted and terminal_failed outcomes", async () => {
    const manager = new OfflineQueueManager();
    const removeFromQueue = vi.fn(async () => undefined);
    let call = 0;

    const result = await manager.processQueue(
      async () => [
        {
          id: "msg-1",
          conversationId: "c",
          content: "hello",
          recipientPubkey: "a".repeat(64) as any,
          createdAt: new Date(),
          retryCount: 0,
          nextRetryAt: new Date(),
        },
        {
          id: "msg-2",
          conversationId: "c",
          content: "hello",
          recipientPubkey: "b".repeat(64) as any,
          createdAt: new Date(),
          retryCount: 4,
          nextRetryAt: new Date(),
        },
      ],
      async () => {
        call += 1;
        return call === 1
          ? { status: "accepted" as const, reasonCode: "relay_degraded" as const }
          : { status: "terminal_failed" as const, reasonCode: "max_retries_exceeded" as const, error: "retry budget exhausted" };
      },
      removeFromQueue
    );

    expect(result.processed).toBe(2);
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(1);
    expect(removeFromQueue).toHaveBeenCalledTimes(2);
  });
});
