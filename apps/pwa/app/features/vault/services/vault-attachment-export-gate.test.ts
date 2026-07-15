import { describe, expect, it } from "vitest";
import {
  buildVaultAttachmentExportGateInput,
  resolveDmPeerPublicKeyHexFromConversationId,
} from "./vault-attachment-export-gate";
import { requiresAttachmentExportConfirm } from "@/app/features/dm-kernel/dm-kernel-trust-export-action-gate";
import type { VaultMediaItem } from "../types/vault-media-item";

const MY = "a".repeat(64);
const PEER = "b".repeat(64);

const createItem = (overrides: Partial<VaultMediaItem> = {}): VaultMediaItem => ({
  id: "vault-1",
  messageId: "m-1",
  timestamp: new Date(1_700_000_000_000),
  remoteUrl: "https://cdn.example.com/file.bin",
  isLocalCached: true,
  localRelativePath: "vault/file.bin",
  sourceConversationId: [MY, PEER].sort().join(":"),
  attachment: {
    kind: "file",
    url: "https://cdn.example.com/file.bin",
    contentType: "application/octet-stream",
    fileName: "photo.jpg",
  },
  ...overrides,
});

describe("vault-attachment-export-gate", () => {
  it("resolves dm peer from canonical conversation id", () => {
    const conversationId = [MY, PEER].sort().join(":");
    expect(resolveDmPeerPublicKeyHexFromConversationId(MY, conversationId)).toBe(PEER);
  });

  it("builds confirm-worthy input for risky filenames", () => {
    const input = buildVaultAttachmentExportGateInput(createItem({
      attachment: {
        kind: "file",
        url: "https://cdn.example.com/file.bin",
        contentType: "application/octet-stream",
        fileName: "invoice.pdf.exe",
      },
    }), {
      myPublicKeyHex: MY,
      isPeerAccepted: () => true,
      getPeerFirstSeenAtUnixMs: () => null,
    });
    expect(input.attachmentFileName).toBe("invoice.pdf.exe");
    expect(input.isPeerAccepted).toBe(true);
  });

  it("marks unaccepted dm peers as cold for export assessment", () => {
    const input = buildVaultAttachmentExportGateInput(createItem(), {
      myPublicKeyHex: MY,
      isPeerAccepted: () => false,
      getPeerFirstSeenAtUnixMs: () => 1_699_000_000_000,
    });
    expect(input.peerPublicKeyHex).toBe(PEER);
    expect(input.isPeerAccepted).toBe(false);
    expect(input.peerFirstSeenAtUnixMs).toBe(1_699_000_000_000);
  });

  it("treats standalone vault items as trusted for peer context", () => {
    const input = buildVaultAttachmentExportGateInput(createItem({
      sourceConversationId: null,
    }), {
      myPublicKeyHex: MY,
      isPeerAccepted: () => false,
      getPeerFirstSeenAtUnixMs: () => null,
    });
    expect(input.isPeerAccepted).toBe(true);
    expect(input.peerPublicKeyHex).toBe("");
  });

  it("requires confirm for risky vault exports built from dm source metadata", () => {
    const input = buildVaultAttachmentExportGateInput(createItem({
      attachment: {
        kind: "file",
        url: "https://cdn.example.com/file.bin",
        contentType: "application/octet-stream",
        fileName: "invoice.pdf.exe",
      },
    }), {
      myPublicKeyHex: MY,
      isPeerAccepted: () => true,
      getPeerFirstSeenAtUnixMs: () => null,
    });
    expect(requiresAttachmentExportConfirm(input)).toBe(true);
  });
});
