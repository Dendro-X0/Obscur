import { describe, expect, it } from "vitest";
import {
  discoveryDeepLinkInternals,
  resolveDiscoveryQueryFromDeepLinkUrl,
  resolveDiscoveryQueryFromSearchParams,
} from "./discovery-deep-link";

describe("discovery-deep-link", () => {
  it("normalizes raw contact-card tokens to deterministic query input", () => {
    expect(discoveryDeepLinkInternals.normalizeContactCardToken("abc123")).toBe("obscur-card:abc123");
    expect(discoveryDeepLinkInternals.normalizeContactCardToken("obscur-card:abc123")).toBe("obscur-card:abc123");
    expect(discoveryDeepLinkInternals.normalizeContactCardToken("   ")).toBeNull();
  });

  it("extracts contact-card query from obscur deep link", () => {
    expect(resolveDiscoveryQueryFromDeepLinkUrl("obscur://contact?card=abc123")).toBe("obscur-card:abc123");
    expect(resolveDiscoveryQueryFromDeepLinkUrl("obscur://contact/abc123")).toBe("obscur-card:abc123");
  });

  it("extracts contact-card query from generic URL query params", () => {
    expect(resolveDiscoveryQueryFromDeepLinkUrl("https://example.test/invite?contactCard=abc123")).toBe("obscur-card:abc123");
  });

  it("extracts contact-card query directly from search params", () => {
    const params = new URLSearchParams("card=abc123");
    expect(resolveDiscoveryQueryFromSearchParams(params)).toBe("obscur-card:abc123");
  });

  it("returns null for unsupported deep links", () => {
    expect(resolveDiscoveryQueryFromDeepLinkUrl("obscur://invite/HELLO")).toBeNull();
    expect(resolveDiscoveryQueryFromDeepLinkUrl("not a url")).toBeNull();
  });
});
