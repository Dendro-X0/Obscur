import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const read = (relativePath: string): string => (
  readFileSync(resolve(process.cwd(), relativePath), "utf8")
);

describe("Cut 1.3 K-OUTBOX-LS owner-uniqueness", () => {
  it("dm-message-queue never persists QUEUE_KEY under kernel outbox authority", () => {
    const source = read("app/features/messaging/services/dm-message-queue.ts");
    expect(source).toContain('DM_MESSAGE_QUEUE_STORAGE_KEY = "dm_message_queue_v1"');
    expect(source).toContain("usesKernelOutboxAuthority");
    expect(source).toMatch(
      /persistQueue[\s\S]*?usesKernelOutboxAuthority\(\)[\s\S]*?scrubLegacyQueueKey[\s\S]*?return;/,
    );
    expect(source).toMatch(
      /queueMessage[\s\S]*?usesKernelOutboxAuthority\(\)[\s\S]*?return;/,
    );
    expect(source).toMatch(
      /initMessageQueue[\s\S]*?usesKernelOutboxAuthority\(\)[\s\S]*?scrubLegacyQueueKey/,
    );
  });

  it("sendDmWithRetry refuses LS queue claim on native", () => {
    const source = read("app/features/messaging/controllers/v2/dm-send-with-retry.ts");
    expect(source).toContain("usesKernelOutboxAuthority");
    expect(source).toMatch(
      /queueOutgoingForRetry[\s\S]*?usesKernelOutboxAuthority\(\)[\s\S]*?queued:\s*false/,
    );
    expect(source).toContain("native_outbox_ls_subtracted");
  });
});

describe("Cut 1.3 runtime: no dm_message_queue_v1 writes when native", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock("@/app/features/runtime/native-persistence-policy", () => ({
      requiresSqlitePersistence: () => true,
    }));
    localStorage.clear();
  });

  afterEach(() => {
    vi.doUnmock("@/app/features/runtime/native-persistence-policy");
    vi.resetModules();
    localStorage.clear();
  });

  it("queueMessage + persist path never setItem dm_message_queue_v1", async () => {
    const {
      queueMessage,
      initMessageQueue,
      DM_MESSAGE_QUEUE_STORAGE_KEY,
      dmMessageQueueInternals,
    } = await import("./dm-message-queue");

    localStorage.setItem(DM_MESSAGE_QUEUE_STORAGE_KEY, JSON.stringify([{ id: "leak" }]));
    initMessageQueue(async () => ({ success: true }));
    expect(localStorage.getItem(DM_MESSAGE_QUEUE_STORAGE_KEY)).toBeNull();

    const setItem = vi.spyOn(Storage.prototype, "setItem");
    queueMessage({
      id: "msg-1",
      conversationId: "c1",
      recipientPubkey: "b".repeat(64) as never,
      plaintext: "secret",
      senderPubkey: "a".repeat(64) as never,
      senderPrivateKeyHex: "c".repeat(64) as never,
      createdAtMs: Date.now(),
    });
    dmMessageQueueInternals.persistQueue();

    const writes = setItem.mock.calls.filter(([key]) => String(key) === DM_MESSAGE_QUEUE_STORAGE_KEY);
    expect(writes).toEqual([]);
    expect(dmMessageQueueInternals.getMessageQueueLength()).toBe(0);
    expect(localStorage.getItem(DM_MESSAGE_QUEUE_STORAGE_KEY)).toBeNull();
    setItem.mockRestore();
  });
});
