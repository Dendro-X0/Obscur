import { describe, expect, it } from "vitest";
import {
  MATRIX_INVITE_REQUIRES_OBSCUR_NOSTR,
  PRIVATE_DC_INVITE_REQUIRES_OBSCUR_NOSTR,
  resolveConnectionRequestInvitePolicy,
} from "./private-trust-invite-policy";

describe("Cut 2.3 private-trust invite policy", () => {
  it("allows Obscur-Nostr giftwrap invites", () => {
    expect(resolveConnectionRequestInvitePolicy("nostr")).toEqual({
      allowed: true,
      userMessage: "",
    });
  });

  it("refuses private_dc with honest Obscur-Nostr module copy", () => {
    const policy = resolveConnectionRequestInvitePolicy("private_dc");
    expect(policy.allowed).toBe(false);
    expect(policy.reasonCode).toBe(PRIVATE_DC_INVITE_REQUIRES_OBSCUR_NOSTR);
    expect(policy.userMessage).toMatch(/Obscur-Nostr/i);
    expect(policy.userMessage).not.toMatch(/Soft L3 Fixed/i); // must not claim Pass; copy may mention ≠ Soft L3
  });

  it("refuses matrix with honest module copy", () => {
    const policy = resolveConnectionRequestInvitePolicy("matrix");
    expect(policy.allowed).toBe(false);
    expect(policy.reasonCode).toBe(MATRIX_INVITE_REQUIRES_OBSCUR_NOSTR);
    expect(policy.userMessage).toMatch(/Obscur-Nostr/i);
  });
});
