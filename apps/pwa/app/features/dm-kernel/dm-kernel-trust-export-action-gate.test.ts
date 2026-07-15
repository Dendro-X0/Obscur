import { describe, expect, it } from "vitest";
import {
  requiresAttachmentExportConfirm,
  resolveAttachmentExportFriction,
} from "./dm-kernel-trust-export-action-gate";

const PEER = "c".repeat(64);
const baseMs = 1_700_000_000_000;

describe("dm-kernel-trust-export-action-gate", () => {
  it("requires confirm for risky attachment filenames regardless of peer trust", () => {
    const input = {
      peerPublicKeyHex: PEER,
      isPeerAccepted: true,
      attachmentFileName: "invoice.pdf.exe",
      messageTimestampUnixMs: baseMs,
      threadFirstPeerMessageAtUnixMs: baseMs,
      nowUnixMs: baseMs,
    };
    expect(resolveAttachmentExportFriction(input)).toBe("confirm");
    expect(requiresAttachmentExportConfirm(input)).toBe(true);
  });

  it("requires confirm for elevated cold-peer thread shapes", () => {
    const input = {
      peerPublicKeyHex: PEER,
      isPeerAccepted: false,
      attachmentFileName: "photo.jpg",
      messageContent: "Please send your seed phrase to verify",
      messageTimestampUnixMs: baseMs,
      threadFirstPeerMessageAtUnixMs: baseMs,
      nowUnixMs: baseMs,
    };
    expect(requiresAttachmentExportConfirm(input)).toBe(true);
  });

  it("allows benign exports from accepted peers", () => {
    const input = {
      peerPublicKeyHex: PEER,
      isPeerAccepted: true,
      attachmentFileName: "photo.jpg",
      messageContent: "Here is the photo from yesterday",
      messageTimestampUnixMs: baseMs,
      threadFirstPeerMessageAtUnixMs: baseMs,
      nowUnixMs: baseMs,
    };
    expect(resolveAttachmentExportFriction(input)).toBe("none");
    expect(requiresAttachmentExportConfirm(input)).toBe(false);
  });

  it("requires confirm for repeat-hash campaign attachments", () => {
    const input = {
      peerPublicKeyHex: PEER,
      isPeerAccepted: true,
      attachmentFileName: "photo.jpg",
      messageContent: "shared file",
      messageTimestampUnixMs: baseMs,
      threadFirstPeerMessageAtUnixMs: baseMs,
      attachmentRepeatHashDistinctPeerCount: 3,
      nowUnixMs: baseMs,
    };
    expect(resolveAttachmentExportFriction(input)).toBe("confirm");
    expect(requiresAttachmentExportConfirm(input)).toBe(true);
  });
});
