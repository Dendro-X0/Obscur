import { describe, expect, it } from "vitest";
import { isValidInviteCode, parseInviteCode } from "./invite-parser";

describe("invite-parser", () => {
  it("accepts canonical invite code format with case-insensitive input", () => {
    expect(isValidInviteCode("OBSCUR-ABCDE")).toBe(true);
    expect(isValidInviteCode("obscur-a1b2c")).toBe(true);
  });

  it("rejects malformed invite codes", () => {
    expect(isValidInviteCode("")).toBe(false);
    expect(isValidInviteCode("OBSCUR-AB")).toBe(false);
    expect(isValidInviteCode("OBSCUR-ABCDEFGHIJK")).toBe(false);
    expect(isValidInviteCode("HELLO-ABCDE")).toBe(false);
  });

  it("parses and normalizes invite code to canonical uppercase format", () => {
    expect(parseInviteCode(" obscur-a1b2c ")).toEqual({
      code: "OBSCUR-A1B2C",
    });
  });
});
