import { beforeEach, describe, expect, it } from "vitest";
import {
  getAttachmentRepeatHashDistinctPeerCount,
  recordAttachmentContentDigestObservation,
} from "./dm-kernel-trust-attachment-fanout-state";
import { ATTACHMENT_REPEAT_HASH_WINDOW_MS } from "./dm-kernel-trust-metadata-signals";

const PROFILE = "profile-fanout";
const DIGEST = "d".repeat(64);
const baseMs = 1_700_000_000_000;

const peer = (label: string): string => label.repeat(64);

describe("dm-kernel-trust-attachment-fanout-state", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("counts distinct peers per digest and dedupes repeat sends", () => {
    recordAttachmentContentDigestObservation(PROFILE, DIGEST, peer("a"), baseMs);
    recordAttachmentContentDigestObservation(PROFILE, DIGEST, peer("b"), baseMs + 1_000);
    expect(getAttachmentRepeatHashDistinctPeerCount(PROFILE, DIGEST, baseMs + 2_000)).toBe(2);

    recordAttachmentContentDigestObservation(PROFILE, DIGEST, peer("a"), baseMs + 3_000);
    expect(getAttachmentRepeatHashDistinctPeerCount(PROFILE, DIGEST, baseMs + 4_000)).toBe(2);
  });

  it("prunes observations outside the repeat-hash window", () => {
    recordAttachmentContentDigestObservation(
      PROFILE,
      DIGEST,
      peer("a"),
      baseMs - ATTACHMENT_REPEAT_HASH_WINDOW_MS - 1,
    );
    recordAttachmentContentDigestObservation(PROFILE, DIGEST, peer("b"), baseMs);
    expect(getAttachmentRepeatHashDistinctPeerCount(PROFILE, DIGEST, baseMs)).toBe(1);
  });
});
