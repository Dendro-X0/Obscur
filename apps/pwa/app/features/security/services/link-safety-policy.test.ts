import { describe, expect, it } from "vitest";
import {
  buildLinkSafetyConsentCopy,
  isLinkSafetyOutboundCheckEnabled,
  LINK_SAFETY_DEFAULT_PROVIDER_LABEL,
  resolveLinkSafetyAfterCancel,
  resolveLinkSafetyOpenDecision,
} from "./link-safety-policy";

describe("link-safety-policy (PB2-A)", () => {
  it("defaults outbound check off even under strict attack profile", () => {
    expect(
      isLinkSafetyOutboundCheckEnabled({
        outboundCheckEnabled: false,
        attackModeSafetyProfile: "strict",
      }),
    ).toBe(false);
    expect(
      resolveLinkSafetyOpenDecision({
        outboundCheckEnabled: false,
        attackModeSafetyProfile: "strict",
      }),
    ).toEqual({ kind: "open_without_check" });
  });

  it("offers labeled reputation check only when enabled", () => {
    expect(
      resolveLinkSafetyOpenDecision({ outboundCheckEnabled: true }),
    ).toEqual({
      kind: "offer_reputation_check",
      cancelBehavior: "block_open",
    });
  });

  it("honors cancelBehavior open_unchecked", () => {
    expect(
      resolveLinkSafetyOpenDecision({
        outboundCheckEnabled: true,
        cancelBehavior: "open_unchecked",
      }),
    ).toEqual({
      kind: "offer_reputation_check",
      cancelBehavior: "open_unchecked",
    });
    expect(resolveLinkSafetyAfterCancel("open_unchecked")).toEqual({
      kind: "open_without_check",
    });
    expect(resolveLinkSafetyAfterCancel("block_open")).toEqual({
      kind: "block_open",
    });
  });

  it("builds consent copy with provider label for visible phone-home", () => {
    const copy = buildLinkSafetyConsentCopy();
    expect(copy.providerLabel).toBe(LINK_SAFETY_DEFAULT_PROVIDER_LABEL);
    expect(copy.descriptionKey).toBe("security.linkSafety.reputation.description");
    expect(copy.titleKey).toBe("security.linkSafety.reputation.title");
  });
});
