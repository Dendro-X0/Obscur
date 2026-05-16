import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setProfileRuntimeScope } from "@/app/features/profiles/services/profile-runtime-scope";
import { useVaultMedia } from "./use-vault-media";

const vaultHookMocks = vi.hoisted(() => ({
  getAll: vi.fn(),
}));

const identityState = vi.hoisted(() => ({
  publicKeyHex: "a".repeat(64) as string | null,
}));

const profileScopeState = vi.hoisted(() => ({
  activeProfileId: "default",
}));

const vaultBusRuntime = vi.hoisted(() => {
  const { createProfileMessageBus } =
    require("@dweb/core/profile-message-bus") as typeof import("@dweb/core/profile-message-bus");
  const api = {
    bus: createProfileMessageBus({ profileId: "default" }),
    sync(profileId: string) {
      api.bus = createProfileMessageBus({ profileId });
      setProfileRuntimeScope({ profileId, bus: api.bus });
    },
  };
  return api;
});

vi.mock("../../profiles/providers/profile-runtime-provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../profiles/providers/profile-runtime-provider")>();
  return {
    ...actual,
    useOptionalProfileMessageBus: () => vaultBusRuntime.bus,
  };
});

vi.mock("@dweb/storage/indexed-db", () => ({
  messagingDB: {
    getAll: vaultHookMocks.getAll,
  },
}));

vi.mock("../../auth/hooks/use-identity", () => ({
  useIdentity: () => ({
    state: {
      publicKeyHex: identityState.publicKeyHex,
      stored: null,
    },
  }),
}));

vi.mock("../../profiles/services/profile-scope", () => ({
  readRegistryBackedActiveProfileId: () => profileScopeState.activeProfileId,
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
    identityState.publicKeyHex = "a".repeat(64);
    profileScopeState.activeProfileId = "default";
    vaultBusRuntime.sync("default");
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
      vaultBusRuntime.bus.publish({
        type: "chat-state-replaced",
        profileId: "default",
        publicKeyHex: "a".repeat(64),
      });
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

  it("refreshes aggregated media when the derived message index is rebuilt for the active account", async () => {
    vaultHookMocks.getAll
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        id: "m-2",
        conversationId: "dm:a:c",
        timestamp: new Date("2026-04-14T00:00:00.000Z"),
        attachments: [{
          kind: "audio",
          url: "https://cdn.example.com/voice.wav",
          contentType: "audio/wav",
          fileName: "voice.wav",
        }],
      }]);

    const { result } = renderHook(() => useVaultMedia());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.mediaItems).toHaveLength(0);

    await act(async () => {
      vaultBusRuntime.bus.publish({
        type: "messages-index-rebuilt",
        detail: {
          publicKeyHex: "a".repeat(64),
          profileId: "default",
          messageCount: 1,
        },
      });
    });

    await waitFor(() => {
      expect(result.current.mediaItems).toHaveLength(1);
    });
    expect(result.current.mediaItems[0]?.attachment.fileName).toBe("voice.wav");
  });

  it("ignores refresh events from another profile scope", async () => {
    vaultHookMocks.getAll.mockResolvedValue([]);

    const { result } = renderHook(() => useVaultMedia());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    vaultHookMocks.getAll.mockClear();

    await act(async () => {
      vaultBusRuntime.bus.publish({
        type: "chat-state-replaced",
        profileId: "work",
        publicKeyHex: "a".repeat(64),
      });
    });

    expect(vaultHookMocks.getAll).not.toHaveBeenCalled();
  });

  it("clears aggregated media when the active identity signs out", async () => {
    vaultHookMocks.getAll.mockResolvedValue([{
      id: "m-3",
      conversationId: "dm:a:d",
      timestamp: new Date("2026-04-14T00:00:00.000Z"),
      attachments: [{
        kind: "image",
        url: "https://cdn.example.com/photo.png",
        contentType: "image/png",
        fileName: "photo.png",
      }],
    }]);

    const { result, rerender } = renderHook(() => useVaultMedia());

    await waitFor(() => {
      expect(result.current.mediaItems).toHaveLength(1);
    });

    identityState.publicKeyHex = null;
    rerender();

    await waitFor(() => {
      expect(result.current.mediaItems).toHaveLength(0);
      expect(result.current.isLoading).toBe(false);
    });
  });

  it("reloads media for the next active account instead of retaining the previous account's set", async () => {
    vaultHookMocks.getAll.mockImplementation(async () => {
      if (identityState.publicKeyHex === "b".repeat(64)) {
        return [{
          id: "m-b-1",
          conversationId: "dm:c:d",
          timestamp: new Date("2026-04-14T00:00:00.000Z"),
          attachments: [{
            kind: "audio",
            url: "https://cdn.example.com/account-b.wav",
            contentType: "audio/wav",
            fileName: "account-b.wav",
          }],
        }];
      }
      return [{
        id: "m-a-1",
        conversationId: "dm:a:b",
        timestamp: new Date("2026-04-14T00:00:00.000Z"),
        attachments: [{
          kind: "image",
          url: "https://cdn.example.com/account-a.png",
          contentType: "image/png",
          fileName: "account-a.png",
        }],
      }];
    });

    const { result, rerender } = renderHook(() => useVaultMedia());

    await waitFor(() => {
      expect(result.current.mediaItems).toHaveLength(1);
    });
    expect(result.current.mediaItems[0]?.attachment.fileName).toBe("account-a.png");

    identityState.publicKeyHex = "b".repeat(64);
    rerender();

    await waitFor(() => {
      expect(result.current.mediaItems).toHaveLength(1);
    });
    expect(result.current.mediaItems[0]?.attachment.fileName).toBe("account-b.wav");
  });
});
