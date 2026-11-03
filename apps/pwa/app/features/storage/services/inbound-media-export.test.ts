import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Attachment } from "@/app/features/messaging/types";
import {
  exportInboundMediaToUserPath,
  requiresInboundMediaExportConfirm,
} from "./inbound-media-export";

const downloadAttachmentToUserPath = vi.fn();

vi.mock("@/app/features/vault/services/local-media-store", () => ({
  downloadAttachmentToUserPath: (...args: unknown[]) => downloadAttachmentToUserPath(...args),
}));

const png: Attachment = {
  kind: "image",
  url: "blob:https://app/local",
  contentType: "image/png",
  fileName: "photo.png",
};

const exe: Attachment = {
  kind: "file",
  url: "blob:https://app/local",
  contentType: "application/octet-stream",
  fileName: "setup.exe",
};

describe("requiresInboundMediaExportConfirm (P2-S S4)", () => {
  it("requires confirm for quarantined content even when MIME looks safe", () => {
    expect(requiresInboundMediaExportConfirm({
      contentAvailabilityState: "quarantined",
      mimeType: "image/png",
      fileName: "photo.png",
    })).toBe(true);
  });

  it("requires confirm for policy-denied extensions", () => {
    expect(requiresInboundMediaExportConfirm({
      mimeType: "application/octet-stream",
      fileName: "setup.exe",
    })).toBe(true);
    expect(requiresInboundMediaExportConfirm({
      mimeType: "image/svg+xml",
      fileName: "icon.svg",
    })).toBe(true);
  });

  it("does not require sandbox confirm for preview-safe available media", () => {
    expect(requiresInboundMediaExportConfirm({
      contentAvailabilityState: "available",
      mimeType: "image/png",
      fileName: "photo.png",
    })).toBe(false);
  });
});

describe("exportInboundMediaToUserPath (P2-S S4)", () => {
  beforeEach(() => {
    downloadAttachmentToUserPath.mockReset();
    downloadAttachmentToUserPath.mockResolvedValue("saved");
  });

  it("refuses without userConsentConfirmed (no auto-open)", async () => {
    const result = await exportInboundMediaToUserPath({
      attachment: exe,
      userConsentConfirmed: false,
    });
    expect(result).toEqual({ status: "consent_required" });
    expect(downloadAttachmentToUserPath).not.toHaveBeenCalled();
  });

  it("copies to user path after consent without shell open", async () => {
    const result = await exportInboundMediaToUserPath({
      attachment: png,
      userConsentConfirmed: true,
      sourceUrl: png.url,
      contentAvailabilityState: "available",
    });
    expect(result).toEqual({ status: "saved" });
    expect(downloadAttachmentToUserPath).toHaveBeenCalledWith({
      attachment: png,
      sourceUrl: png.url,
    });
  });

  it("maps cancelled and failed download outcomes", async () => {
    downloadAttachmentToUserPath.mockResolvedValueOnce("cancelled");
    expect(await exportInboundMediaToUserPath({
      attachment: png,
      userConsentConfirmed: true,
    })).toEqual({ status: "cancelled" });

    downloadAttachmentToUserPath.mockResolvedValueOnce("failed");
    expect(await exportInboundMediaToUserPath({
      attachment: png,
      userConsentConfirmed: true,
    })).toEqual({ status: "failed", reason: "download_failed" });
  });
});
