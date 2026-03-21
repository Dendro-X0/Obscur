import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../utils/get-stored-identity", () => ({
  getStoredIdentity: vi.fn(),
}));

vi.mock("../utils/identity-profile-binding", () => ({
  ensureIdentityProfileBinding: vi.fn(),
  recoverStoredIdentityProfile: vi.fn(),
  recoverSingleStoredIdentityProfile: vi.fn(),
}));

import { getStoredIdentity } from "../utils/get-stored-identity";
import { recoverStoredIdentityProfile } from "../utils/identity-profile-binding";
import { recoverSingleStoredIdentityProfile } from "../utils/identity-profile-binding";
import { useIdentityInternals } from "./use-identity";

describe("useIdentity rehydrate", () => {
  beforeEach(() => {
    useIdentityInternals.resetForTests();
    vi.clearAllMocks();
    vi.mocked(recoverStoredIdentityProfile).mockResolvedValue(null);
    vi.mocked(recoverSingleStoredIdentityProfile).mockResolvedValue(null);
  });

  it("preserves unlocked identity when profile change keeps the same pubkey", async () => {
    const stored = {
      encryptedPrivateKey: "cipher",
      publicKeyHex: "f".repeat(64) as any,
      username: "alice",
    };

    useIdentityInternals.setIdentityState(
      useIdentityInternals.createUnlockedState({
        stored,
        privateKeyHex: "a".repeat(64) as any,
      })
    );

    vi.mocked(getStoredIdentity).mockResolvedValue({ record: stored });
    await useIdentityInternals.rehydrateIdentityForActiveProfile();

    const snapshot = useIdentityInternals.getIdentitySnapshot();
    expect(snapshot.status).toBe("unlocked");
    expect(snapshot.publicKeyHex).toBe(stored.publicKeyHex);
    expect(snapshot.privateKeyHex).toBe("a".repeat(64));
  });

  it("preserves stored username on same-pubkey re-import when no username is provided", () => {
    const pubkey = "f".repeat(64) as any;
    const preserved = useIdentityInternals.resolveImportedIdentityUsername({
      requestedUsername: undefined,
      importedPublicKeyHex: pubkey,
      existingStoredPublicKeyHex: pubkey,
      existingStoredUsername: "Alice",
    });
    expect(preserved).toBe("Alice");
  });

  it("preserves stored username when provided username is blank whitespace", () => {
    const pubkey = "f".repeat(64) as any;
    const preserved = useIdentityInternals.resolveImportedIdentityUsername({
      requestedUsername: "   ",
      importedPublicKeyHex: pubkey,
      existingStoredPublicKeyHex: pubkey,
      existingStoredUsername: "Alice",
    });
    expect(preserved).toBe("Alice");
  });

  it("does not reuse username from a different stored pubkey during import", () => {
    const importedPubkey = "f".repeat(64) as any;
    const existingPubkey = "a".repeat(64) as any;
    const preserved = useIdentityInternals.resolveImportedIdentityUsername({
      requestedUsername: undefined,
      importedPublicKeyHex: importedPubkey,
      existingStoredPublicKeyHex: existingPubkey,
      existingStoredUsername: "Alice",
    });
    expect(preserved).toBeUndefined();
  });
});
