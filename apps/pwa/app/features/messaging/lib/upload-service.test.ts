import { beforeEach, describe, expect, it, vi } from "vitest";
import { LocalUploadService, getAttachmentKind, uploadServiceInternals } from "./upload-service";

describe("upload-service provider normalization", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("rewrites legacy provider URLs and removes duplicates", () => {
    const urls = uploadServiceInternals.normalizeProviderUrls({
      apiUrls: [
        "https://nostr.build/api/v2/upload/files",
        "https://api.sovbit.host/api/upload/files",
        "https://nostr.build/api/v2/upload/files",
      ],
    });

    expect(urls).toEqual([
      "https://nostr.build/api/v2/nip96/upload",
      "https://api.sovbit.host/api/upload/files",
    ]);
  });

  it("normalizes combined apiUrl + apiUrls input", () => {
    const urls = uploadServiceInternals.normalizeProviderUrls({
      apiUrl: " https://nostr.build/api/v2/upload/files ",
      apiUrls: ["https://cdn.nostrcheck.me"],
    });

    expect(urls).toEqual([
      "https://cdn.nostrcheck.me",
      "https://nostr.build/api/v2/nip96/upload",
    ]);
  });

  it("keeps large-media friendly providers in the default provider set", () => {
    expect(uploadServiceInternals.DEFAULT_NIP96_PROVIDER_URLS).toEqual(expect.arrayContaining([
      "https://cdn.nostrcheck.me",
      "https://nostr.build/api/v2/nip96/upload",
      "https://api.sovbit.host/api/upload/files",
    ]));
  });

  it("normalizes local upload responses into absolute urls", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        url: "/uploads/avatar.png",
        contentType: "image/png",
      }),
    } as Response);

    const service = new LocalUploadService();
    const file = new File(["avatar"], "avatar.png", { type: "image/png" });
    const attachment = await service.uploadFile(file);

    expect(attachment.url).toBe(`${window.location.origin}/uploads/avatar.png`);
  });

  it("classifies voice-note prefixed webm uploads as voice_note", () => {
    const file = new File(["voice"], "voice-note-1774249000000-d12.webm", { type: "video/webm" });
    expect(getAttachmentKind(file)).toBe("voice_note");
  });
});
