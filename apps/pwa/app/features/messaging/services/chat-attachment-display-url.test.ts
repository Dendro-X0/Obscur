import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/features/vault/services/local-media-store", () => ({
  resolveLocalMediaUrl: vi.fn(async () => null),
  fetchRemoteAttachmentBytesForVaultSave: vi.fn(async () => null),
}));

vi.mock("@/app/features/les/sdk/les-native-sdk", () => ({
  isLesNativeAvailable: vi.fn(() => false),
  listLesObjects: vi.fn(async () => []),
  readLesObjectDecrypted: vi.fn(async () => new Uint8Array()),
}));

vi.mock("@/app/features/storage/services/vault-at-rest", () => ({
  resolveVaultProfileId: vi.fn(() => "tester2"),
}));

vi.mock("@/app/features/vault/services/vault-media-blob-lifecycle", () => ({
  registerVaultMediaBlobUrl: (_remote: string, blobUrl: string) => blobUrl,
}));

import {
  fetchChatAttachmentDisplayFallback,
  isPersistedBlobAttachmentUrl,
  isSessionOnlyMediaUrl,
  resolveChatAttachmentDisplayUrl,
} from "./chat-attachment-display-url";
import {
  fetchRemoteAttachmentBytesForVaultSave,
  resolveLocalMediaUrl,
} from "@/app/features/vault/services/local-media-store";
import {
  isLesNativeAvailable,
  listLesObjects,
  readLesObjectDecrypted,
} from "@/app/features/les/sdk/les-native-sdk";

describe("chat-attachment-display-url", () => {
  beforeEach(() => {
    vi.mocked(resolveLocalMediaUrl).mockReset().mockResolvedValue(null);
    vi.mocked(fetchRemoteAttachmentBytesForVaultSave).mockReset().mockResolvedValue(null);
    vi.mocked(isLesNativeAvailable).mockReset().mockReturnValue(false);
    vi.mocked(listLesObjects).mockReset().mockResolvedValue([]);
    vi.mocked(readLesObjectDecrypted).mockReset().mockResolvedValue(new Uint8Array());
  });

  it("classifies blob urls as non-durable", () => {
    expect(isPersistedBlobAttachmentUrl("blob:http://localhost/1")).toBe(true);
    expect(isPersistedBlobAttachmentUrl("https://cdn.example/a.jpg")).toBe(false);
    expect(isSessionOnlyMediaUrl("blob:http://localhost/1")).toBe(true);
    expect(isSessionOnlyMediaUrl("https://cdn.example/a.jpg")).toBe(false);
  });

  it("prefers local media url when index resolves", async () => {
    vi.mocked(resolveLocalMediaUrl).mockResolvedValue("asset://localhost/local.jpg");
    await expect(resolveChatAttachmentDisplayUrl("https://cdn.example/a.jpg")).resolves.toBe(
      "asset://localhost/local.jpg",
    );
  });

  it("prefers LES decrypt blob when sourceAttachmentUrl matches", async () => {
    vi.mocked(isLesNativeAvailable).mockReturnValue(true);
    vi.mocked(listLesObjects).mockResolvedValue([
      {
        lesObjectId: "obj-1",
        profileId: "tester2",
        kind: "image",
        displayName: "a.jpg",
        contentType: "image/jpeg",
        byteLength: 3,
        createdAtUnixMs: 1,
        source: "chat_save",
        sourceAttachmentUrl: "https://cdn.example/a.jpg",
        relativePath: "profiles/tester2/les/images/obj-1.obscurvault",
      },
    ]);
    vi.mocked(readLesObjectDecrypted).mockResolvedValue(new Uint8Array([1, 2, 3]));
    const originalCreate = URL.createObjectURL;
    URL.createObjectURL = vi.fn(() => "blob:http://localhost/les-preview");
    try {
      await expect(resolveChatAttachmentDisplayUrl("https://cdn.example/a.jpg")).resolves.toBe(
        "blob:http://localhost/les-preview",
      );
    } finally {
      URL.createObjectURL = originalCreate;
    }
  });

  it("falls back to native fetch bytes as blob after remote failure path", async () => {
    vi.mocked(fetchRemoteAttachmentBytesForVaultSave).mockResolvedValue(new Uint8Array([9, 9]));
    const originalCreate = URL.createObjectURL;
    URL.createObjectURL = vi.fn(() => "blob:http://localhost/native-fetch");
    try {
      await expect(fetchChatAttachmentDisplayFallback("https://cdn.example/a.jpg")).resolves.toBe(
        "blob:http://localhost/native-fetch",
      );
    } finally {
      URL.createObjectURL = originalCreate;
    }
  });

  it("returns null fallback when native fetch has no bytes", async () => {
    await expect(fetchChatAttachmentDisplayFallback("https://cdn.example/a.jpg")).resolves.toBeNull();
  });
});
