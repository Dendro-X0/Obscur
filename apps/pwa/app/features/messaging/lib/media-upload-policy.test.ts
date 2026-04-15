import { describe, expect, it } from "vitest";
import {
  MEDIA_RUNTIME_SAFETY_LIMITS,
  shouldAvoidInMemoryAttachmentCaching,
  shouldPreferBrowserUploadForRuntimeSafety,
  shouldSkipPreprocessForRuntimeSafety,
  validateAttachmentBatchForRuntimeSafety,
} from "./media-upload-policy";

const createFile = (params: Readonly<{
  name: string;
  type: string;
  sizeBytes: number;
}>): File => new File([new Uint8Array(params.sizeBytes)], params.name, { type: params.type });

describe("media-upload-policy runtime safety", () => {
  it("skips heavyweight preprocessing for oversized browser video/image files", () => {
    const largeVideo = createFile({
      name: "large-video.mp4",
      type: "video/mp4",
      sizeBytes: MEDIA_RUNTIME_SAFETY_LIMITS.videoPreprocessBytes + 1,
    });
    const largeImage = createFile({
      name: "large-image.jpg",
      type: "image/jpeg",
      sizeBytes: MEDIA_RUNTIME_SAFETY_LIMITS.imagePreprocessBytes + 1,
    });

    expect(shouldSkipPreprocessForRuntimeSafety(largeVideo)).toBe(true);
    expect(shouldSkipPreprocessForRuntimeSafety(largeImage)).toBe(true);
  });

  it("prefers browser upload over native byte upload for oversized native files", () => {
    const largeAudio = createFile({
      name: "large-audio.mp3",
      type: "audio/mpeg",
      sizeBytes: MEDIA_RUNTIME_SAFETY_LIMITS.nativeDirectUploadBytes + 1,
    });

    expect(shouldPreferBrowserUploadForRuntimeSafety(largeAudio, true)).toBe(true);
    expect(shouldPreferBrowserUploadForRuntimeSafety(largeAudio, false)).toBe(false);
  });

  it("rejects oversized attachment batches before processing begins", () => {
    const first = createFile({
      name: "archive-a.bin",
      type: "application/octet-stream",
      sizeBytes: MEDIA_RUNTIME_SAFETY_LIMITS.pendingAttachmentBatchBytes / 2,
    });
    const second = createFile({
      name: "archive-b.bin",
      type: "application/octet-stream",
      sizeBytes: MEDIA_RUNTIME_SAFETY_LIMITS.pendingAttachmentBatchBytes / 2,
    });
    const third = createFile({
      name: "archive-c.bin",
      type: "application/octet-stream",
      sizeBytes: 10,
    });

    const error = validateAttachmentBatchForRuntimeSafety([third], [first, second]);
    expect(error).toContain("Selected attachments exceed");
  });

  it("rejects multiple video attachments in one message", () => {
    const first = createFile({
      name: "clip-a.mp4",
      type: "video/mp4",
      sizeBytes: 20 * 1024 * 1024,
    });
    const second = createFile({
      name: "clip-b.mp4",
      type: "video/mp4",
      sizeBytes: 12 * 1024 * 1024,
    });

    const error = validateAttachmentBatchForRuntimeSafety([second], [first]);
    expect(error).toContain("Only 1 video can be attached per message");
  });

  it("skips in-memory sent-file caching for large uploads", () => {
    const hugeFile = createFile({
      name: "huge.bin",
      type: "application/octet-stream",
      sizeBytes: MEDIA_RUNTIME_SAFETY_LIMITS.inMemorySentCacheBytes + 1,
    });

    expect(shouldAvoidInMemoryAttachmentCaching(hugeFile)).toBe(true);
  });
});
