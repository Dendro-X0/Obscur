import { describe, expect, it } from "vitest";
import {
  detectLookalikeBrandLink,
  detectSuspiciousLink,
  extractHttpUrls,
  isLookalikeBrandUrl,
  isSuspiciousUrlShape,
} from "./dm-kernel-trust-link-signals";

describe("dm-kernel-trust-link-signals", () => {
  it("extracts http(s) URLs from message text", () => {
    expect(extractHttpUrls("See https://example.com/path and http://foo.bar.")).toEqual([
      "https://example.com/path",
      "http://foo.bar",
    ]);
  });

  it("flags credential-path URLs", () => {
    expect(isSuspiciousUrlShape("https://obscur-wallet-security.example/login?session=abc")).toBe(true);
    expect(isSuspiciousUrlShape("https://cdn.example.com/blog/post")).toBe(false);
  });

  it("flags IP-literal and punycode hosts", () => {
    expect(isSuspiciousUrlShape("http://192.168.0.1/reset")).toBe(true);
    expect(isSuspiciousUrlShape("https://xn--pple-43d.com/signin")).toBe(true);
  });

  it("flags known shortener domains", () => {
    expect(isSuspiciousUrlShape("http://bit.ly/secure-account-reset")).toBe(true);
    expect(isSuspiciousUrlShape("https://t.co/abc123")).toBe(true);
  });

  it("does not flag benign URLs without structural phish shape", () => {
    expect(detectSuspiciousLink("Docs: https://github.com/Dendro-X0/Obscur")).toBe(false);
  });

  it("detects suspicious link in cold-phish message body", () => {
    expect(detectSuspiciousLink(
      "Verify your wallet at https://wallet-verify.example/verify?id=1",
    )).toBe(true);
  });

  it("detects lookalike brand URLs separately from credential-path shape", () => {
    expect(isLookalikeBrandUrl("https://paypa1-secure.com/home")).toBe(true);
    expect(detectLookalikeBrandLink("Login at https://obscur-wallet-verify.example")).toBe(true);
    expect(detectLookalikeBrandLink("Docs: https://github.com/Dendro-X0/Obscur")).toBe(false);
  });
});
