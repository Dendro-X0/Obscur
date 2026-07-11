/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import {
  buildIdentityBindingFromResolvedIdentity,
  buildIdentityBindingViewModel,
  formatIdentityKeyFragment,
  identityBindingSourceI18nKey,
} from "./identity-binding-presenter";

const PK = "87cb2c2063308d194111eaa99643697dfa526af07516f09d4722258a94830125";

describe("identity-binding-presenter (ASE-1b)", () => {
  it("builds npub fragment and marks display names untrusted", () => {
    const binding = buildIdentityBindingViewModel({
      publicKeyHex: PK,
      displayName: "Alice",
      resolverSource: "friend_code_v3",
      friendCode: "OBSCUR-ABC123",
    });
    expect(binding?.displayName).toBe("Alice");
    expect(binding?.displayNameUntrusted).toBe(true);
    expect(binding?.npub.startsWith("npub1")).toBe(true);
    expect(binding?.npubFragment).toContain("…");
    expect(binding?.friendCode).toBe("OBSCUR-ABC123");
  });

  it("maps resolver sources to i18n keys", () => {
    expect(identityBindingSourceI18nKey("connection_request")).toBe(
      "security.identityBinding.source.connectionRequest",
    );
    expect(identityBindingSourceI18nKey("hex")).toBe("security.identityBinding.source.hex");
  });

  it("builds from resolved identity", () => {
    const binding = buildIdentityBindingFromResolvedIdentity({
      pubkey: PK,
      display: "Bob",
      source: "npub",
      confidence: "direct",
    });
    expect(binding?.resolverSource).toBe("npub");
    expect(binding?.confidence).toBe("direct");
  });

  it("formats long keys with ellipsis", () => {
    expect(formatIdentityKeyFragment("short")).toBe("short");
    expect(formatIdentityKeyFragment("012345678901234567890")).toContain("…");
  });

  it("rejects invalid pubkey input", () => {
    expect(buildIdentityBindingViewModel({
      publicKeyHex: "not-a-key",
      resolverSource: "manual",
    })).toBeNull();
  });
});
