import { describe, expect, it, vi } from "vitest";
import type { Message } from "@/app/features/messaging/types";
import {
  buildVaultMediaItemsFast,
  collectVaultMediaCandidates,
  enrichVaultMediaItemsWithLocalUrls,
  sortVaultMediaItemsNewestFirst,
} from "./vault-media-aggregator";

vi.mock("./local-media-store", () => ({
  getLocalMediaIndexEntryByRemoteUrl: vi.fn((url: string) => (
    url === "https://cdn.example.com/cached.png"
      ? { relativePath: "vault/cached.png", remoteUrl: url, savedAtUnixMs: 1, fileName: "cached.png", contentType: "image/png", size: 1 }
      : null
  )),
  resolveLocalMediaUrl: vi.fn(async (url: string) => (
    url === "https://cdn.example.com/cached.png" ? "asset://cached.png" : null
  )),
}));

const message = (overrides: Partial<Message> & Pick<Message, "id">): Message => ({
  id: overrides.id,
  conversationId: overrides.conversationId ?? "dm:a:b",
  timestamp: overrides.timestamp ?? new Date("2026-04-14T00:00:00.000Z"),
  sender: "a".repeat(64),
  content: "",
  attachments: overrides.attachments,
  ...overrides,
} as Message);

describe("vault-media-aggregator", () => {
  it("collects only vault attachment kinds", () => {
    const messages = [
      message({
        id: "m-1",
        attachments: [
          { kind: "image", url: "https://cdn.example.com/a.png", contentType: "image/png", fileName: "a.png" },
          { kind: "voice", url: "https://cdn.example.com/voice", contentType: "audio/ogg", fileName: "v.ogg" },
        ],
      }),
    ];
    const candidates = collectVaultMediaCandidates(messages);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.attachment.kind).toBe("image");
  });

  it("builds items from sync index without awaiting local resolve", () => {
    const messages = [
      message({
        id: "m-2",
        attachments: [
          { kind: "image", url: "https://cdn.example.com/cached.png", contentType: "image/png", fileName: "cached.png" },
          { kind: "video", url: "https://cdn.example.com/remote.mp4", contentType: "video/mp4", fileName: "remote.mp4" },
        ],
      }),
    ];
    const items = buildVaultMediaItemsFast(collectVaultMediaCandidates(messages));
    expect(items).toHaveLength(2);
    expect(items.find((item) => item.remoteUrl.includes("cached"))).toMatchObject({
      isLocalCached: true,
      attachment: expect.objectContaining({ url: "https://cdn.example.com/cached.png" }),
    });
    expect(items.find((item) => item.remoteUrl.includes("remote"))).toMatchObject({
      isLocalCached: false,
    });
  });

  it("sorts newest first", () => {
    const items = sortVaultMediaItemsNewestFirst([
      {
        id: "old",
        messageId: "m-old",
        attachment: { kind: "image", url: "https://cdn.example.com/old.png", contentType: "image/png", fileName: "old.png" },
        timestamp: new Date("2026-01-01T00:00:00.000Z"),
        remoteUrl: "https://cdn.example.com/old.png",
        isLocalCached: false,
        localRelativePath: null,
        sourceConversationId: null,
      },
      {
        id: "new",
        messageId: "m-new",
        attachment: { kind: "image", url: "https://cdn.example.com/new.png", contentType: "image/png", fileName: "new.png" },
        timestamp: new Date("2026-04-14T00:00:00.000Z"),
        remoteUrl: "https://cdn.example.com/new.png",
        isLocalCached: false,
        localRelativePath: null,
        sourceConversationId: null,
      },
    ]);
    expect(items[0]?.id).toBe("new");
  });

  it("enriches cached items with bounded local url resolution", async () => {
    const items = buildVaultMediaItemsFast(collectVaultMediaCandidates([
      message({
        id: "m-3",
        attachments: [
          { kind: "image", url: "https://cdn.example.com/cached.png", contentType: "image/png", fileName: "cached.png" },
        ],
      }),
    ]));
    const enriched = await enrichVaultMediaItemsWithLocalUrls(items, { concurrency: 2 });
    expect(enriched[0]?.attachment.url).toBe("asset://cached.png");
    expect(enriched[0]?.isLocalCached).toBe(true);
  });
});
