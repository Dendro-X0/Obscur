import { describe, expect, it } from "vitest";
import {
  ATTACHMENT_REPEAT_HASH_PEER_THRESHOLD,
  extractAttachmentContentDigestFromUrl,
  resolveAttachmentContentDigestsFromUrls,
  resolvePeerWotDistanceV1,
  shouldTriggerAttachmentRepeatHashSignal,
  shouldTriggerGraphWotDistanceSignal,
} from "./dm-kernel-trust-metadata-signals";

describe("dm-kernel-trust-metadata-signals", () => {
  it("resolves v1 WoT distance for accepted vs outside-web peers", () => {
    expect(resolvePeerWotDistanceV1("a".repeat(64), true)).toBe(1);
    expect(resolvePeerWotDistanceV1("a".repeat(64), false)).toBeNull();
    expect(shouldTriggerGraphWotDistanceSignal(null)).toBe(true);
    expect(shouldTriggerGraphWotDistanceSignal(1)).toBe(false);
  });

  it("extracts CAS attachment digests and skips blob URLs", () => {
    const hash = "a".repeat(64);
    expect(extractAttachmentContentDigestFromUrl(`https://cas.obscur.app/blob/${hash}`)).toBe(hash);
    expect(extractAttachmentContentDigestFromUrl("blob:https://localhost/abc")).toBeNull();
    expect(resolveAttachmentContentDigestsFromUrls([
      `https://cas.obscur.app/blob/${hash}`,
      "blob:local",
    ])).toEqual([hash]);
  });

  it("fires repeat-hash signal at peer threshold", () => {
    expect(shouldTriggerAttachmentRepeatHashSignal(ATTACHMENT_REPEAT_HASH_PEER_THRESHOLD - 1)).toBe(false);
    expect(shouldTriggerAttachmentRepeatHashSignal(ATTACHMENT_REPEAT_HASH_PEER_THRESHOLD)).toBe(true);
  });
});
