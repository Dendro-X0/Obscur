import { beforeEach, describe, expect, it } from "vitest";
import { derivePublicKeyHex } from "@dweb/crypto/derive-public-key-hex";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";

import {
  captureRetiredIdentityRegistrySnapshot,
  isRetiredIdentityPublicKey,
  markRetiredIdentityPublicKey,
  restoreRetiredIdentityRegistrySnapshot,
} from "./retired-identity-registry";

describe("retired-identity-registry", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("stores retired identities and recognizes them", () => {
    const privateKeyHex = "a".repeat(64) as PrivateKeyHex;
    const publicKeyHex = derivePublicKeyHex(privateKeyHex);
    expect(isRetiredIdentityPublicKey(publicKeyHex)).toBe(false);

    markRetiredIdentityPublicKey({ publicKeyHex });
    expect(isRetiredIdentityPublicKey(publicKeyHex)).toBe(true);
  });

  it("deduplicates entries when the same key is retired again", () => {
    const publicKeyHex = derivePublicKeyHex("b".repeat(64) as PrivateKeyHex);
    markRetiredIdentityPublicKey({ publicKeyHex, profileId: "default" });
    const firstSnapshot = captureRetiredIdentityRegistrySnapshot();
    expect(firstSnapshot.entries.filter((entry) => entry.publicKeyHex === publicKeyHex)).toHaveLength(1);

    markRetiredIdentityPublicKey({ publicKeyHex, profileId: "other-profile" });
    const secondSnapshot = captureRetiredIdentityRegistrySnapshot();
    expect(secondSnapshot.entries.filter((entry) => entry.publicKeyHex === publicKeyHex)).toHaveLength(1);
    expect(secondSnapshot.entries[0]?.profileId).toBe("other-profile");
  });

  it("restores a captured registry snapshot", () => {
    const publicKeyHex = derivePublicKeyHex("c".repeat(64) as PrivateKeyHex);
    markRetiredIdentityPublicKey({ publicKeyHex, profileId: "default" });
    const snapshot = captureRetiredIdentityRegistrySnapshot();

    window.localStorage.clear();
    expect(isRetiredIdentityPublicKey(publicKeyHex)).toBe(false);

    restoreRetiredIdentityRegistrySnapshot(snapshot);
    expect(isRetiredIdentityPublicKey(publicKeyHex)).toBe(true);
  });
});
