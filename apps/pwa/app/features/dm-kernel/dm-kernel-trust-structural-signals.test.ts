import { describe, expect, it } from "vitest";
import {
  detectOtpExfilStructuralShape,
  hasMixedScriptHostname,
} from "./dm-kernel-trust-structural-signals";

describe("dm-kernel-trust-structural-signals", () => {
  it("detects mixed-script hostnames", () => {
    expect(hasMixedScriptHostname("p\u0430ypal.com")).toBe(true);
    expect(hasMixedScriptHostname("paypal.com")).toBe(false);
    expect(hasMixedScriptHostname("example.com")).toBe(false);
  });

  it("detects imperative OTP exfil shapes", () => {
    expect(detectOtpExfilStructuralShape("Send me 847291 now")).toBe(true);
    expect(detectOtpExfilStructuralShape("Reply with code 123456")).toBe(true);
    expect(detectOtpExfilStructuralShape("Enter 8 4 7 2 9 1 in the app")).toBe(true);
  });

  it("does not flag bare years or casual chat without code context", () => {
    expect(detectOtpExfilStructuralShape("See you in 2026")).toBe(false);
    expect(detectOtpExfilStructuralShape("Can we sync on the deployment tomorrow?")).toBe(false);
    expect(detectOtpExfilStructuralShape("847291")).toBe(false);
  });
});
