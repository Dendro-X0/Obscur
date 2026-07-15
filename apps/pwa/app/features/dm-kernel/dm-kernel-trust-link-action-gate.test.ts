import { describe, expect, it } from "vitest";
import {
  requiresLinkConfirmBeforeOpen,
  resolveLinkOpenFriction,
} from "./dm-kernel-trust-link-action-gate";

describe("dm-kernel-trust-link-action-gate", () => {
  it("requires confirm for credential-shaped and lookalike URLs", () => {
    expect(resolveLinkOpenFriction("https://obscur-wallet-verify.example/login")).toBe("confirm");
    expect(resolveLinkOpenFriction("https://paypa1-secure.com/home")).toBe("confirm");
    expect(requiresLinkConfirmBeforeOpen("http://bit.ly/secure-account-reset")).toBe(true);
  });

  it("allows benign URLs without friction", () => {
    expect(resolveLinkOpenFriction("https://github.com/Dendro-X0/Obscur")).toBe("none");
    expect(requiresLinkConfirmBeforeOpen("https://example.com/docs")).toBe(false);
  });
});
