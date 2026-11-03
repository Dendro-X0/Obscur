import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createInboundMediaPreviewObjectUrl,
  shouldAllowInboundMediaPreview,
} from "./inbound-media-preview";

describe("inbound-media-preview (P2-S S3)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("blocks preview when contentAvailabilityState is quarantined", () => {
    expect(shouldAllowInboundMediaPreview({
      contentAvailabilityState: "quarantined",
      mimeType: "image/png",
      fileName: "ok.png",
    })).toBe(false);
  });

  it("blocks SVG / HTML preview even when availability is available", () => {
    expect(shouldAllowInboundMediaPreview({
      contentAvailabilityState: "available",
      mimeType: "image/svg+xml",
      fileName: "x.svg",
    })).toBe(false);
    expect(shouldAllowInboundMediaPreview({
      contentAvailabilityState: "available",
      mimeType: "text/html",
      fileName: "page.html",
    })).toBe(false);
  });

  it("allows preview-safe PNG", () => {
    expect(shouldAllowInboundMediaPreview({
      contentAvailabilityState: "available",
      mimeType: "image/png",
      fileName: "pic.png",
      byteLength: 32,
    })).toBe(true);
  });

  it("createInboundMediaPreviewObjectUrl returns null when denied and blob URL when allowed", () => {
    const createObjectURL = vi.fn(() => "blob:test-preview");
    const original = URL.createObjectURL;
    URL.createObjectURL = createObjectURL;

    const denied = createInboundMediaPreviewObjectUrl(
      new Blob(["<svg></svg>"], { type: "image/svg+xml" }),
      { fileName: "x.svg", contentAvailabilityState: "available" },
    );
    expect(denied).toBeNull();
    expect(createObjectURL).not.toHaveBeenCalled();

    const allowed = createInboundMediaPreviewObjectUrl(
      new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }),
      { fileName: "a.png", contentAvailabilityState: "available" },
    );
    expect(allowed).toBe("blob:test-preview");
    expect(createObjectURL).toHaveBeenCalledOnce();

    URL.createObjectURL = original;
  });
});
