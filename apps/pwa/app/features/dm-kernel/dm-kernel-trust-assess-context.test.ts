import { beforeEach, describe, expect, it } from "vitest";
import {
  enrichDmTrustAssessInput,
  resolveAttachmentRepeatHashDistinctPeerCount,
} from "./dm-kernel-trust-assess-context";
import { recordAttachmentContentDigestObservation } from "./dm-kernel-trust-attachment-fanout-state";

const PROFILE = "profile-assess-context";
const PEER_A = "a".repeat(64);
const PEER_B = "b".repeat(64);
const DIGEST = "d".repeat(64);
const baseMs = 1_700_000_000_000;

describe("dm-kernel-trust-assess-context", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("enriches WoT distance from acceptance state", () => {
    const enriched = enrichDmTrustAssessInput({
      peerPublicKeyHex: PEER_A,
      isPeerAccepted: true,
      messageContent: "hello",
      messageTimestampUnixMs: baseMs,
      threadFirstPeerMessageAtUnixMs: baseMs,
      dismissedUntilUnixMs: null,
      nowUnixMs: baseMs,
    });
    expect(enriched.peerWotDistance).toBe(1);
  });

  it("resolves repeat-hash peer count from fanout store", () => {
    recordAttachmentContentDigestObservation(PROFILE, DIGEST, PEER_A, baseMs);
    recordAttachmentContentDigestObservation(PROFILE, DIGEST, PEER_B, baseMs + 1_000);
    recordAttachmentContentDigestObservation(PROFILE, DIGEST, PEER_B, baseMs + 2_000);

    expect(resolveAttachmentRepeatHashDistinctPeerCount(
      PROFILE,
      [DIGEST],
      baseMs + 3_000,
    )).toBe(2);

    const enriched = enrichDmTrustAssessInput({
      peerPublicKeyHex: PEER_A,
      isPeerAccepted: false,
      messageContent: "see file",
      messageTimestampUnixMs: baseMs,
      threadFirstPeerMessageAtUnixMs: baseMs,
      dismissedUntilUnixMs: null,
      profileId: PROFILE,
      messageAttachmentContentDigests: [DIGEST],
      nowUnixMs: baseMs + 3_000,
    });
    expect(enriched.attachmentRepeatHashDistinctPeerCount).toBe(2);
  });
});
