import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Message } from "@/app/features/messaging/types";
import { scanMessagesForVaultMedia } from "./vault-message-scan";

const scanMocks = vi.hoisted(() => ({
  forEachInStore: vi.fn(),
}));

vi.mock("@dweb/storage/indexed-db", () => ({
  messagingDB: {
    forEachInStore: scanMocks.forEachInStore,
  },
}));

const imageMessage = (id: string): Message => ({
  id,
  kind: "user",
  content: "",
  timestamp: new Date("2026-04-14T00:00:00.000Z"),
  isOutgoing: false,
  status: "delivered",
  conversationId: "dm:a:b",
  attachments: [{
    kind: "image",
    url: `https://cdn.example.com/${id}.png`,
    contentType: "image/png",
    fileName: `${id}.png`,
  }],
} as Message);

describe("scanMessagesForVaultMedia", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scanMocks.forEachInStore.mockImplementation(async (
      _store: string,
      visitor: (value: Message) => boolean | void,
    ) => {
      await visitor(imageMessage("m-1"));
      return 1;
    });
  });

  it("collects candidates via cursor scan without getAll", async () => {
    const candidates = await scanMessagesForVaultMedia();
    expect(scanMocks.forEachInStore).toHaveBeenCalledWith(
      "messages",
      expect.any(Function),
      expect.objectContaining({ indexName: "timestampMs", direction: "prev" }),
    );
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.attachment.fileName).toBe("m-1.png");
  });

  it("streams candidate batches while scanning", async () => {
    const batches: number[] = [];
    scanMocks.forEachInStore.mockImplementation(async (
      _store: string,
      visitor: (value: Message) => boolean | void,
    ) => {
      await visitor(imageMessage("m-1"));
      await visitor(imageMessage("m-2"));
      return 2;
    });

    await scanMessagesForVaultMedia({
      onCandidatesBatch: (batch) => {
        batches.push(batch.length);
      },
    });

    expect(batches.length).toBeGreaterThan(0);
    expect(batches.reduce((sum, count) => sum + count, 0)).toBe(2);
  });

  it("stops scanning when isCancelled returns true", async () => {
    scanMocks.forEachInStore.mockImplementation(async (
      _store: string,
      visitor: (value: Message) => boolean | void,
    ) => {
      await visitor(imageMessage("m-1"));
      await visitor(imageMessage("m-2"));
      return 2;
    });

    const candidates = await scanMessagesForVaultMedia({
      isCancelled: () => true,
    });
    expect(candidates).toHaveLength(0);
  });
});
