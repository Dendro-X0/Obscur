import { describe, expect, it } from "vitest";
import { resolveTrustCopyKey } from "./dm-kernel-trust-copy-keys";
import {
  BUNDLE_FIN_COLD,
  BUNDLE_PHISH_COLD,
  BUNDLE_SE_COLD,
} from "./dm-kernel-trust-assessment-port";

describe("dm-kernel-trust-copy-keys", () => {
  it("selects attachment-specific phish copy", () => {
    expect(resolveTrustCopyKey(
      ["contact.cold", "attachment.risky_filename"],
      BUNDLE_PHISH_COLD,
      "elevated",
    )).toBe("messaging.trust.phishAttachmentCold");
  });

  it("selects lookalike-specific phish copy", () => {
    expect(resolveTrustCopyKey(
      ["contact.cold", "link.lookalike_brand"],
      BUNDLE_PHISH_COLD,
      "elevated",
    )).toBe("messaging.trust.phishLookalikeCold");
  });

  it("selects remote-access SE copy", () => {
    expect(resolveTrustCopyKey(
      ["contact.cold", "thread.remote_access_tool"],
      BUNDLE_SE_COLD,
      "critical",
    )).toBe("messaging.trust.seRemoteAccessCold");
  });

  it("selects stale financial copy for financial_pressure bundle", () => {
    expect(resolveTrustCopyKey(
      ["contact.cold", "thread.financial_pressure"],
      BUNDLE_FIN_COLD,
      "elevated",
    )).toBe("messaging.trust.finStaleCold");
  });
});
