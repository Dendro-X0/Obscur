import { describe, expect, it } from "vitest";
import {
  isPrivateTrustComposeFace,
  PRIVATE_DC_SILENT_NOSTR_FALLBACK_REFUSED,
  privateTrustComposeTransportCopy,
} from "./private-trust-compose-policy";

describe("Cut 2.2 private-trust compose policy", () => {
  it("marks only private_dc as compose face", () => {
    expect(isPrivateTrustComposeFace("private_dc")).toBe(true);
    expect(isPrivateTrustComposeFace("nostr")).toBe(false);
    expect(isPrivateTrustComposeFace("matrix")).toBe(false);
  });

  it("names H-dc · T3 transport chrome", () => {
    const copy = privateTrustComposeTransportCopy();
    expect(copy.label).toMatch(/H-dc/i);
    expect(copy.label).toMatch(/T3/i);
    expect(copy.detail.toLowerCase()).toContain("accepted");
  });

  it("exports silent Nostr fallback refuse code", () => {
    expect(PRIVATE_DC_SILENT_NOSTR_FALLBACK_REFUSED).toBe(
      "private_dc_silent_nostr_fallback_refused",
    );
  });
});
