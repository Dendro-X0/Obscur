import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useVaultMedia } from "./use-vault-media";
import { CHAT_STATE_REPLACED_EVENT } from "../../messaging/services/chat-state-store";

const vaultHookMocks = vi.hoisted(() => ({
  getAll: vi.fn(),
}));

vi.mock("@dweb/storage/indexed-db", () => ({
  messagingDB: {
    getAll: vaultHookMocks.getAll,
  },
}));

vi.mock("../services/local-media-store", () => ({
  deleteLocalMediaCacheItem: vi.fn(async () => undefined),
  downloadAttachmentToUserPath: vi.fn(async () => true),
  getLocalMediaIndexEntryByRemoteUrl: vi.fn(() => null),
  resolveLocalMediaUrl: vi.fn(async () => null),
}));

describe("useVaultMedia", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refreshes aggregated media when chat state is replaced", async () => {
    vaultHookMocks.getAll
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        id: "m-1",
        conversationId: "dm:a:b",
        timestamp: new Date("2026-04-14T00:00:00.000Z"),
        attachments: [{
          kind: "image",
          url: "https://cdn.example.com/restore-image.png",
          contentType: "image/png",
          fileName: "restore-image.png",
        }],
      }]);

    const { result } = renderHook(() => useVaultMedia());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.mediaItems).toHaveLength(0);

    await act(async () => {
      window.dispatchEvent(new CustomEvent(CHAT_STATE_REPLACED_EVENT, {
        detail: { publicKeyHex: "a".repeat(64) },
      }));
    });

    await waitFor(() => {
      expect(result.current.mediaItems).toHaveLength(1);
    });
    expect(result.current.mediaItems[0]).toEqual(expect.objectContaining({
      messageId: "m-1",
      sourceConversationId: "dm:a:b",
      attachment: expect.objectContaining({
        fileName: "restore-image.png",
      }),
    }));
  });
});
