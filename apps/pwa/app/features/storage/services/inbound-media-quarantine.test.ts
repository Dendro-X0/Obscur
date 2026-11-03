import { describe, expect, it } from "vitest";
import {
  buildProfileQuarantineRelativePath,
  planInboundMediaWrite,
  relativePathBelongsToProfileQuarantine,
  sanitizeQuarantineObjectId,
} from "./inbound-media-quarantine";

const SHA = "a".repeat(64);

describe("inbound-media-quarantine (P2-S S2)", () => {
  it("builds per-profile quarantine relative paths", () => {
    expect(buildProfileQuarantineRelativePath("default", SHA)).toBe(
      `profiles/default/quarantine/${SHA}`,
    );
    expect(buildProfileQuarantineRelativePath("Alice Team", SHA)).toBe(
      `profiles/Alice Team/quarantine/${SHA}`,
    );
    // Path-traversal-shaped profile ids are rejected even after vault sanitize.
    expect(buildProfileQuarantineRelativePath("../evil", SHA)).toBeNull();
  });

  it("rejects unsafe object ids", () => {
    expect(sanitizeQuarantineObjectId("../x")).toBeNull();
    expect(sanitizeQuarantineObjectId("not-hex")).toBeNull();
    expect(buildProfileQuarantineRelativePath("default", "abc")).toBeNull();
  });

  it("fail-closes path membership checks", () => {
    const ok = `profiles/default/quarantine/${SHA}`;
    expect(relativePathBelongsToProfileQuarantine(ok, "default")).toBe(true);
    expect(relativePathBelongsToProfileQuarantine(ok, "other")).toBe(false);
    expect(relativePathBelongsToProfileQuarantine(
      `profiles/default/quarantine/../vault/${SHA}`,
      "default",
    )).toBe(false);
    expect(relativePathBelongsToProfileQuarantine(
      `profiles/other/quarantine/${SHA}`,
      "default",
    )).toBe(false);
  });

  it("plans allow_preview for safe PNG and quarantines SVG", () => {
    const allowed = planInboundMediaWrite({
      profileId: "default",
      sha256: SHA,
      mimeType: "image/png",
      fileName: "pic.png",
      byteLength: 100,
    });
    expect(allowed.allowPreview).toBe(true);
    expect(allowed.contentAvailabilityState).toBe("available");
    expect(allowed.allowSystemOpen).toBe(false);
    expect(allowed.quarantineRelativePath).toBe(`profiles/default/quarantine/${SHA}`);

    const denied = planInboundMediaWrite({
      profileId: "default",
      sha256: SHA,
      mimeType: "image/svg+xml",
      fileName: "x.svg",
      byteLength: 100,
    });
    expect(denied.allowPreview).toBe(false);
    expect(denied.contentAvailabilityState).toBe("quarantined");
    expect(denied.allowSystemOpen).toBe(false);
    expect(denied.quarantineRelativePath).toBe(`profiles/default/quarantine/${SHA}`);
  });
});
