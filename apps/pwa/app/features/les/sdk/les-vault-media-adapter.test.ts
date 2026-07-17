import { describe, expect, it } from "vitest";
import {
  buildLesRemoteUrl,
  buildVideoPosterSeekUrl,
  isLesPreviewPendingUrl,
  isVaultMediaPlaybackUrl,
  mapLesMetaToVaultMediaItem,
  parseLesRemoteUrl,
  LES_PREVIEW_PENDING_PLACEHOLDER,
} from "./les-vault-media-adapter";
import type { LesObjectMeta } from "./les-native-sdk";

const sampleMeta = (overrides: Partial<LesObjectMeta> = {}): LesObjectMeta => ({
  lesObjectId: "obj-1",
  profileId: "tester2",
  kind: "image",
  displayName: "pexels-pixabay-60628.jpg",
  contentType: "image/jpeg",
  byteLength: 12,
  createdAtUnixMs: 1_700_000_000_000,
  source: "chat_save",
  sourceAttachmentUrl: "https://cdn.example/x.jpg",
  relativePath: "profiles/tester2/les/images/obj-1.obscurvault",
  ...overrides,
});

describe("les-vault-media-adapter", () => {
  it("builds and parses stable les:// remote urls", () => {
    const url = buildLesRemoteUrl("tester2", "obj-1");
    expect(url).toBe("les://tester2/obj-1");
    expect(parseLesRemoteUrl(url)).toEqual({ profileId: "tester2", lesObjectId: "obj-1" });
  });

  it("maps LES meta into VaultMediaGrid item shape", () => {
    const item = mapLesMetaToVaultMediaItem(sampleMeta());
    expect(item.id).toBe("obj-1");
    expect(item.remoteUrl).toBe("les://tester2/obj-1");
    expect(item.isLocalCached).toBe(true);
    expect(item.localRelativePath).toContain("/les/images/");
    expect(item.sourceConversationId).toBeNull();
    expect(item.attachment.kind).toBe("image");
    expect(item.attachment.fileName).toBe("pexels-pixabay-60628.jpg");
    expect(item.attachment.url).toBe(LES_PREVIEW_PENDING_PLACEHOLDER);
  });

  it("prefers decrypted blob preview url when provided", () => {
    const item = mapLesMetaToVaultMediaItem(sampleMeta(), "blob:http://localhost/preview");
    expect(item.attachment.url).toBe("blob:http://localhost/preview");
    expect(item.remoteUrl).toBe("les://tester2/obj-1");
  });

  it("keeps les:// only as remote identity, not as default img src when preview given", () => {
    const item = mapLesMetaToVaultMediaItem(
      sampleMeta(),
      "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
    );
    expect(item.attachment.url.startsWith("data:")).toBe(true);
    expect(item.remoteUrl.startsWith("les://")).toBe(true);
  });

  it("classifies LES pending vs playback-ready urls", () => {
    expect(isLesPreviewPendingUrl(LES_PREVIEW_PENDING_PLACEHOLDER)).toBe(true);
    expect(isLesPreviewPendingUrl("les://tester2/obj-1")).toBe(true);
    expect(isLesPreviewPendingUrl("blob:http://localhost/preview")).toBe(false);
    expect(isVaultMediaPlaybackUrl("blob:http://localhost/preview")).toBe(true);
    expect(isVaultMediaPlaybackUrl(LES_PREVIEW_PENDING_PLACEHOLDER)).toBe(false);
    expect(isVaultMediaPlaybackUrl("les://tester2/obj-1")).toBe(false);
  });

  it("appends seek fragment only for remote http(s) poster urls", () => {
    expect(buildVideoPosterSeekUrl("blob:http://localhost/v")).toBe("blob:http://localhost/v");
    expect(buildVideoPosterSeekUrl(LES_PREVIEW_PENDING_PLACEHOLDER)).toBe(LES_PREVIEW_PENDING_PLACEHOLDER);
    expect(buildVideoPosterSeekUrl("https://cdn.example/v.mp4")).toBe("https://cdn.example/v.mp4#t=0.1");
  });
});
