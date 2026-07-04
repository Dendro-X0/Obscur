import { describe, expect, it, vi } from "vitest";
import type { Message } from "@/app/features/messaging/types";
import {
  buildStandaloneLocalVaultMediaItems,
  buildVaultMediaItemsFast,
  collectVaultMediaCandidates,
  enrichVaultMediaItemsWithLocalUrls,
  sortVaultMediaItemsNewestFirst,
} from "./vault-media-aggregator";
import { getLocalMediaIndexEntryByRemoteUrl } from "./local-media-store";

vi.mock("./local-media-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./local-media-store")>();
  return {
    ...actual,
    getLocalMediaIndexEntryByRemoteUrl: vi.fn((url: string) => (
      url === "https://cdn.example.com/cached.png"
        ? { relativePath: "vault/cached.png", remoteUrl: url, savedAtUnixMs: 1, fileName: "cached.png", contentType: "image/png", size: 1 }
        : null
    )),
    getLocalMediaIndexSnapshot: vi.fn(() => ({
      "obscur://vault/local/deadbeef": {
        remoteUrl: "obscur://vault/local/deadbeef",
        relativePath: "vault-media/abc.obscurvault",
        savedAtUnixMs: 1_700_000_000_000,
        fileName: "notes.pdf",
        contentType: "application/pdf",
        size: 1024,
      },
    })),
    isLocalVaultOnlyUrl: vi.fn((url: string) => url.startsWith("obscur://vault/local/")),
    resolveLocalMediaUrl: vi.fn(async (url: string) => (
      url === "https://cdn.example.com/cached.png" ? "asset://cached.png" : null
    )),
  };
});

const message = (overrides: Partial<Message> & Pick<Message, "id">): Message => ({
  conversationId: overrides.conversationId ?? "dm:a:b",
  timestamp: overrides.timestamp ?? new Date("2026-04-14T00:00:00.000Z"),
  sender: "a".repeat(64),
  content: "",
  ...overrides,
} as Message);

describe("vault-media-aggregator", () => {
  it("collects only vault attachment kinds", () => {
    const messages = [
      message({
        id: "m-1",
        attachments: [
          { kind: "image", url: "https://cdn.example.com/a.png", contentType: "image/png", fileName: "a.png" },
          { kind: "voice_note", url: "https://cdn.example.com/voice", contentType: "audio/ogg", fileName: "v.ogg" },
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

  it("enriches only the requested slice when limit is set", async () => {
    const { resolveLocalMediaUrl } = await import("./local-media-store");
    const resolveMock = vi.mocked(resolveLocalMediaUrl);
    resolveMock.mockClear();

    const items = buildVaultMediaItemsFast(collectVaultMediaCandidates([
      message({
        id: "m-limit-a",
        attachments: [
          { kind: "image", url: "https://cdn.example.com/cached.png", contentType: "image/png", fileName: "a.png" },
        ],
      }),
      message({
        id: "m-limit-b",
        attachments: [
          { kind: "image", url: "https://cdn.example.com/cached.png", contentType: "image/png", fileName: "b.png" },
        ],
      }),
    ]));

    await enrichVaultMediaItemsWithLocalUrls(items, { limit: 1 });
    expect(resolveMock).toHaveBeenCalledTimes(1);
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

  it("builds standalone local vault items not already in chat scan", () => {
    const existing = new Set(["https://cdn.example.com/cached.png"]);
    const items = buildStandaloneLocalVaultMediaItems(existing);
    expect(items).toHaveLength(1);
    expect(items[0]?.remoteUrl).toBe("obscur://vault/local/deadbeef");
    expect(items[0]?.attachment.fileName).toBe("notes.pdf");
    expect(items[0]?.sourceConversationId).toBeNull();
  });

  it("uses message attachment names when index stores encrypted blob file names", () => {
    const messages = [
      message({
        id: "m-encrypted-name",
        attachments: [
          {
            kind: "image",
            url: "https://cdn.example.com/storm.jpg",
            contentType: "image/jpeg",
            fileName: "storm-photo.jpg",
          },
        ],
      }),
    ];
    vi.mocked(getLocalMediaIndexEntryByRemoteUrl).mockReturnValueOnce({
      relativePath: "vault-media/bf2f9ab5d641772b682a1df5.obscurvault",
      remoteUrl: "https://cdn.example.com/storm.jpg",
      savedAtUnixMs: 1,
      fileName: "bf2f9ab5d641772b682a1df5.obscurvault",
      contentType: "image/jpeg",
      size: 1,
    });
    const items = buildVaultMediaItemsFast(collectVaultMediaCandidates(messages));
    expect(items[0]?.attachment.fileName).toBe("storm-photo.jpg");
  });
});
