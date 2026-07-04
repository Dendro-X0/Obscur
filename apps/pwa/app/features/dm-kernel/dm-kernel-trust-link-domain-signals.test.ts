import { describe, expect, it } from "vitest";
import {
  isLookalikeBrandHostname,
  isOfficialBrandHostname,
} from "./dm-kernel-trust-link-domain-signals";

describe("dm-kernel-trust-link-domain-signals", () => {
  it("accepts official brand hostnames", () => {
    expect(isOfficialBrandHostname("accounts.google.com", ["google.com"])).toBe(true);
    expect(isOfficialBrandHostname("www.paypal.com", ["paypal.com"])).toBe(true);
    expect(isLookalikeBrandHostname("accounts.google.com")).toBe(false);
    expect(isLookalikeBrandHostname("www.coinbase.com")).toBe(false);
  });

  it("flags typosquatted brand hostnames", () => {
    expect(isLookalikeBrandHostname("paypa1-secure.com")).toBe(true);
    expect(isLookalikeBrandHostname("micros0ft-login.example")).toBe(true);
    expect(isLookalikeBrandHostname("obscur-wallet-verify.example")).toBe(true);
    expect(isLookalikeBrandHostname("metamask-login.example")).toBe(true);
  });

  it("does not flag unrelated hostnames", () => {
    expect(isLookalikeBrandHostname("github.com")).toBe(false);
    expect(isLookalikeBrandHostname("example.com")).toBe(false);
  });
});
