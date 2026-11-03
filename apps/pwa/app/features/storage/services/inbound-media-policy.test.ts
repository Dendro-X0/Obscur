import { describe, expect, it } from "vitest";
import {
  evaluateInboundMediaPolicy,
  INBOUND_MEDIA_DEFAULT_MAX_BYTES,
} from "./inbound-media-policy";

describe("evaluateInboundMediaPolicy (P2-S S1)", () => {
  it("allows common preview-safe image and video MIME types", () => {
    expect(evaluateInboundMediaPolicy({ mimeType: "image/png", fileName: "a.png" })).toEqual({
      ok: true,
      action: "allow_preview",
    });
    expect(evaluateInboundMediaPolicy({ mimeType: "image/jpeg; charset=binary", fileName: "a.jpg" }).ok).toBe(true);
    expect(evaluateInboundMediaPolicy({ mimeType: "video/mp4", fileName: "clip.mp4" }).ok).toBe(true);
    expect(evaluateInboundMediaPolicy({ mimeType: "audio/mpeg", fileName: "note.mp3" }).ok).toBe(true);
    expect(evaluateInboundMediaPolicy({ mimeType: "application/pdf", fileName: "doc.pdf" }).ok).toBe(true);
  });

  it("denies SVG / HTML / executable by extension even with friendly MIME", () => {
    expect(evaluateInboundMediaPolicy({
      mimeType: "image/svg+xml",
      fileName: "icon.svg",
    })).toMatchObject({ ok: false, reason: "deny_extension" });

    expect(evaluateInboundMediaPolicy({
      mimeType: "image/png",
      fileName: "payload.svg",
    })).toMatchObject({ ok: false, reason: "deny_extension" });

    expect(evaluateInboundMediaPolicy({
      mimeType: "text/html",
      fileName: "page.html",
    })).toMatchObject({ ok: false, reason: "deny_extension" });

    expect(evaluateInboundMediaPolicy({
      mimeType: "application/octet-stream",
      fileName: "setup.exe",
    })).toMatchObject({ ok: false, reason: "deny_extension" });
  });

  it("denies dangerous MIME when extension is absent", () => {
    expect(evaluateInboundMediaPolicy({ mimeType: "image/svg+xml" })).toMatchObject({
      ok: false,
      reason: "deny_mime",
    });
    expect(evaluateInboundMediaPolicy({ mimeType: "text/html" })).toMatchObject({
      ok: false,
      reason: "deny_mime",
    });
    expect(evaluateInboundMediaPolicy({ mimeType: "application/javascript" })).toMatchObject({
      ok: false,
      reason: "deny_mime",
    });
  });

  it("denies oversize blobs", () => {
    expect(evaluateInboundMediaPolicy({
      mimeType: "image/png",
      fileName: "big.png",
      byteLength: INBOUND_MEDIA_DEFAULT_MAX_BYTES + 1,
    })).toMatchObject({ ok: false, reason: "too_large" });

    expect(evaluateInboundMediaPolicy({
      mimeType: "image/png",
      fileName: "ok.png",
      byteLength: 1024,
      maxBytes: 512,
    })).toMatchObject({ ok: false, reason: "too_large" });
  });

  it("deny-by-default for unknown MIME", () => {
    expect(evaluateInboundMediaPolicy({
      mimeType: "application/x-custom-blob",
      fileName: "data.bin",
    })).toMatchObject({ ok: false, reason: "unknown_type" });
  });

  it("denies when type metadata is missing", () => {
    expect(evaluateInboundMediaPolicy({})).toMatchObject({
      ok: false,
      reason: "missing_type",
    });
  });
});
