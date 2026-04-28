import { beforeEach, describe, expect, it, vi } from "vitest";
import { derivePublicKeyHex } from "@dweb/crypto/derive-public-key-hex";
import { getRememberMeStorageKey } from "../utils/auth-storage-keys";

vi.mock("../utils/get-stored-identity", () => ({
  getStoredIdentity: vi.fn(),
}));

vi.mock("../utils/identity-profile-binding", () => ({
  ensureIdentityProfileBinding: vi.fn(),
  recoverStoredIdentityProfile: vi.fn(),
  recoverSingleStoredIdentityProfile: vi.fn(),
}));

vi.mock("../../runtime/runtime-capabilities", () => ({
  hasNativeRuntime: vi.fn(() => false),
}));

const cryptoServiceMocks = vi.hoisted(() => ({
  hasNativeKey: vi.fn(),
  getNativeNpub: vi.fn(),
  initNativeSession: vi.fn(),
  clearNativeSession: vi.fn(),
  deleteNativeKey: vi.fn(),
}));

vi.mock("../../crypto/crypto-service", () => ({
  cryptoService: {
    hasNativeKey: cryptoServiceMocks.hasNativeKey,
    getNativeNpub: cryptoServiceMocks.getNativeNpub,
    initNativeSession: cryptoServiceMocks.initNativeSession,
    clearNativeSession: cryptoServiceMocks.clearNativeSession,
    deleteNativeKey: cryptoServiceMocks.deleteNativeKey,
  },
  NATIVE_KEY_SENTINEL: "native",
}));

vi.mock("../services/session-api", () => ({
  SessionApi: {
    getSessionStatus: vi.fn(async () => ({ isActive: false, npub: null, isNative: false })),
  },
}));

import { getStoredIdentity } from "../utils/get-stored-identity";
import { recoverStoredIdentityProfile } from "../utils/identity-profile-binding";
import { recoverSingleStoredIdentityProfile } from "../utils/identity-profile-binding";
import { hasNativeRuntime } from "../../runtime/runtime-capabilities";
import { SessionApi } from "../services/session-api";
import { useIdentityInternals } from "./use-identity";

describe("useIdentity rehydrate", () => {
  beforeEach(() => {
    useIdentityInternals.resetForTests();
    vi.clearAllMocks();
    window.localStorage.clear();
    vi.mocked(hasNativeRuntime).mockReturnValue(false);
    vi.mocked(SessionApi.getSessionStatus).mockResolvedValue({ isActive: false, npub: null, isNative: false });
    vi.mocked(recoverStoredIdentityProfile).mockResolvedValue(null);
    vi.mocked(recoverSingleStoredIdentityProfile).mockResolvedValue(null);
  });

  it("bootstraps stored identity from the canonical SessionApi native restore path", async () => {
    const stored = {
      encryptedPrivateKey: "cipher",
      publicKeyHex: "f".repeat(64) as any,
      username: "alice",
    };
    vi.mocked(hasNativeRuntime).mockReturnValue(true);
    vi.mocked(getStoredIdentity).mockResolvedValue({ record: stored });
    vi.mocked(SessionApi.getSessionStatus).mockResolvedValue({
      isActive: true,
      npub: stored.publicKeyHex,
      isNative: true,
    });
    window.localStorage.setItem(getRememberMeStorageKey("default"), "true");

    await useIdentityInternals.ensureInitialized();

    expect(useIdentityInternals.getIdentitySnapshot()).toEqual(expect.objectContaining({
      status: "unlocked",
      publicKeyHex: stored.publicKeyHex,
      privateKeyHex: "native",
      stored: expect.objectContaining({
        publicKeyHex: stored.publicKeyHex,
      }),
    }));
    expect(cryptoServiceMocks.hasNativeKey).not.toHaveBeenCalled();
    expect(cryptoServiceMocks.getNativeNpub).not.toHaveBeenCalled();
  });

  it("does not run a second native key probe after SessionApi reports no restorable session", async () => {
    const stored = {
      encryptedPrivateKey: "cipher",
      publicKeyHex: "f".repeat(64) as any,
      username: "alice",
    };
    vi.mocked(hasNativeRuntime).mockReturnValue(true);
    vi.mocked(getStoredIdentity).mockResolvedValue({ record: stored });
    vi.mocked(SessionApi.getSessionStatus).mockResolvedValue({
      isActive: false,
      npub: null,
      isNative: true,
    });
    cryptoServiceMocks.hasNativeKey.mockResolvedValue(true);
    cryptoServiceMocks.getNativeNpub.mockResolvedValue(stored.publicKeyHex);
    window.localStorage.setItem(getRememberMeStorageKey("default"), "true");

    await useIdentityInternals.ensureInitialized();

    expect(useIdentityInternals.getIdentitySnapshot()).toEqual(expect.objectContaining({
      status: "locked",
      stored: expect.objectContaining({
        publicKeyHex: stored.publicKeyHex,
      }),
    }));
    expect(useIdentityInternals.getIdentityDiagnosticsSnapshot()).toEqual(expect.objectContaining({
      startupState: expect.objectContaining({
        kind: "stored_locked",
        runtimePhaseHint: "auth_required",
      }),
    }));
    expect(cryptoServiceMocks.hasNativeKey).not.toHaveBeenCalled();
    expect(cryptoServiceMocks.getNativeNpub).not.toHaveBeenCalled();
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

  it("surfaces native session mismatch diagnostics and keeps identity locked", async () => {
    const stored = {
      encryptedPrivateKey: "cipher",
      publicKeyHex: "f".repeat(64) as any,
      username: "alice",
    };
    const otherPublicKeyHex = "a".repeat(64);
    vi.mocked(hasNativeRuntime).mockReturnValue(true);
    vi.mocked(SessionApi.getSessionStatus).mockResolvedValue({
      isActive: true,
      npub: otherPublicKeyHex,
      isNative: true,
    });
    useIdentityInternals.setIdentityState(useIdentityInternals.createLockedState(stored));

    const unlocked = await useIdentityInternals.retryNativeSessionUnlockAction();

    expect(unlocked).toBe(false);
    expect(useIdentityInternals.getIdentitySnapshot()).toEqual(expect.objectContaining({
      status: "locked",
      stored: expect.objectContaining({
        publicKeyHex: stored.publicKeyHex,
      }),
    }));
    expect(useIdentityInternals.getIdentityDiagnosticsSnapshot()).toEqual(expect.objectContaining({
      status: "locked",
      storedPublicKeyHex: stored.publicKeyHex,
      nativeSessionPublicKeyHex: otherPublicKeyHex,
      mismatchReason: "native_mismatch",
      startupState: expect.objectContaining({
        kind: "mismatch",
        degradedReasonHint: "native_session_mismatch",
      }),
    }));
  });

  it("keeps identity locked on raw private-key mismatch and surfaces diagnostics", async () => {
    const stored = {
      encryptedPrivateKey: "cipher",
      publicKeyHex: "f".repeat(64) as any,
      username: "alice",
    };
    useIdentityInternals.setIdentityState(useIdentityInternals.createLockedState(stored));

    await expect(useIdentityInternals.unlockWithPrivateKeyHexAction({
      privateKeyHex: "a".repeat(64) as any,
    })).rejects.toThrow("Private key does not match stored identity.");

    expect(useIdentityInternals.getIdentitySnapshot()).toEqual(expect.objectContaining({
      status: "locked",
      stored: expect.objectContaining({
        publicKeyHex: stored.publicKeyHex,
      }),
    }));
    expect(useIdentityInternals.getIdentityDiagnosticsSnapshot()).toEqual(expect.objectContaining({
      status: "locked",
      storedPublicKeyHex: stored.publicKeyHex,
      mismatchReason: "private_key_mismatch",
      startupState: expect.objectContaining({
        kind: "mismatch",
        recoveryActions: ["login", "unlock_with_private_key"],
      }),
    }));
  });

  it("unlocks identity with matching raw private key", async () => {
    const privateKeyHex = "1".repeat(64) as any;
    const stored = {
      encryptedPrivateKey: "cipher",
      publicKeyHex: derivePublicKeyHex(privateKeyHex),
      username: "alice",
    };
    useIdentityInternals.setIdentityState(useIdentityInternals.createLockedState(stored));

    await useIdentityInternals.unlockWithPrivateKeyHexAction({ privateKeyHex });

    expect(useIdentityInternals.getIdentitySnapshot()).toEqual(expect.objectContaining({
      status: "unlocked",
      publicKeyHex: stored.publicKeyHex,
      privateKeyHex,
      stored: expect.objectContaining({
        publicKeyHex: stored.publicKeyHex,
      }),
    }));
  });
});
