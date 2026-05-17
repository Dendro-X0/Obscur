import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IdentityRecord } from "@dweb/core/identity-record";

const mocks = vi.hoisted(() => {
  let entries: Array<{ key: string; value: IdentityRecord }> = [];

  const setEntries = (next: Array<{ key: string; value: IdentityRecord }>) => {
    entries = next;
  };

  const openIdentityDb = vi.fn(async () => ({
    transaction: () => ({
      objectStore: () => ({
        openCursor: () => {
          const request: {
            result: any;
            onsuccess: null | (() => void);
            onerror: null | (() => void);
            error?: Error;
          } = {
            result: null,
            onsuccess: null,
            onerror: null,
          };

          queueMicrotask(() => {
            let index = 0;
            const advance = () => {
              if (index >= entries.length) {
                request.result = null;
                request.onsuccess?.();
                return;
              }
              const current = entries[index]!;
              request.result = {
                key: current.key,
                value: current.value,
                continue: () => {
                  index += 1;
                  advance();
                },
              };
              request.onsuccess?.();
            };
            advance();
          });

          return request;
        },
      }),
    }),
  }));

  return {
    setEntries,
    openIdentityDb,
    getActiveProfileIdSafe: vi.fn(() => "default"),
    getProfileScopeOverride: vi.fn<() => string | null>(() => null),
    getRegistryState: vi.fn(() => ({
      activeProfileId: "default",
      profiles: [
        {
          profileId: "default",
          label: "Default",
          createdAtUnixMs: 1,
          lastUsedAtUnixMs: 1,
          status: "active",
        },
      ],
    })),
    ensureProfile: vi.fn(() => ({ ok: true, value: null })),
    switchProfile: vi.fn(() => ({ ok: true, value: null })),
  };
});

vi.mock("./open-identity-db", () => ({
  openIdentityDb: mocks.openIdentityDb,
}));

vi.mock("@/app/features/profiles/services/profile-scope", () => ({
  getActiveProfileIdSafe: mocks.getActiveProfileIdSafe,
  getProfileScopeOverride: mocks.getProfileScopeOverride,
  getProfileIdentityDbKey: (profileId: string) => `identity::${profileId}`,
}));

vi.mock("@/app/features/profiles/services/profile-registry-service", () => ({
  ProfileRegistryService: {
    getState: mocks.getRegistryState,
    ensureProfile: mocks.ensureProfile,
    switchProfile: mocks.switchProfile,
  },
}));

describe("identity-profile-binding", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    mocks.setEntries([]);
    mocks.getActiveProfileIdSafe.mockReturnValue("default");
    mocks.getProfileScopeOverride.mockReturnValue(null);
    mocks.getRegistryState.mockReturnValue({
      activeProfileId: "default",
      profiles: [
        {
          profileId: "default",
          label: "Default",
          createdAtUnixMs: 1,
          lastUsedAtUnixMs: 1,
          status: "active",
        },
      ],
    });
    mocks.ensureProfile.mockReturnValue({ ok: true, value: null });
    mocks.switchProfile.mockReturnValue({ ok: true, value: null });
  });

  it("reuses an existing stored profile binding for the same public key", async () => {
    const record: IdentityRecord = {
      encryptedPrivateKey: "cipher",
      publicKeyHex: "a".repeat(64),
      username: "Alice",
    };
    mocks.setEntries([{ key: "identity::work", value: record }]);

    const { ensureIdentityProfileBinding } = await import("./identity-profile-binding");
    const profileId = await ensureIdentityProfileBinding({
      publicKeyHex: record.publicKeyHex as any,
      username: record.username,
    });

    expect(profileId).toBe("work");
    expect(mocks.ensureProfile).toHaveBeenCalledWith("work", "Alice");
    expect(mocks.switchProfile).toHaveBeenCalledWith("work");
  });

  it("moves scoped local data into the canonical pubkey-owned slot when no binding exists", async () => {
    localStorage.setItem("dweb.nostr.pwa.profile::default", JSON.stringify({ profile: { username: "Alice" } }));
    sessionStorage.setItem("obscur_auth_token::default", "token");

    const { ensureIdentityProfileBinding, canonicalProfileIdForPublicKey } = await import("./identity-profile-binding");
    const publicKeyHex = "b".repeat(64) as any;
    const targetProfileId = canonicalProfileIdForPublicKey(publicKeyHex);

    const profileId = await ensureIdentityProfileBinding({
      publicKeyHex,
      username: "Alice",
    });

    expect(profileId).toBe(targetProfileId);
    expect(localStorage.getItem(`dweb.nostr.pwa.profile::${targetProfileId}`)).toContain("Alice");
    expect(sessionStorage.getItem(`obscur_auth_token::${targetProfileId}`)).toBe("token");
    expect(mocks.switchProfile).toHaveBeenCalledWith(targetProfileId);
  });

  it("keeps the bound desktop profile slot authoritative when a profile scope override exists", async () => {
    mocks.getActiveProfileIdSafe.mockReturnValue("profile-2");
    mocks.getProfileScopeOverride.mockReturnValue("profile-2");

    const { ensureIdentityProfileBinding } = await import("./identity-profile-binding");
    const publicKeyHex = "d".repeat(64) as any;

    const profileId = await ensureIdentityProfileBinding({
      publicKeyHex,
      username: "Delta",
    });

    expect(profileId).toBe("profile-2");
    expect(mocks.ensureProfile).toHaveBeenCalledWith("profile-2", "Delta");
    expect(mocks.switchProfile).not.toHaveBeenCalled();
  });

  it("copies same-account scoped local state from an existing binding into the explicit desktop profile slot", async () => {
    const record: IdentityRecord = {
      encryptedPrivateKey: "cipher-existing",
      publicKeyHex: "e".repeat(64),
      username: "Echo",
    };
    mocks.setEntries([{ key: "identity::profile-b", value: record }]);
    mocks.getActiveProfileIdSafe.mockReturnValue("profile-a");
    mocks.getProfileScopeOverride.mockReturnValue("profile-a");
    localStorage.setItem(`dweb.nostr.pwa.chatState.v2.${record.publicKeyHex}::profile-b`, JSON.stringify({ createdConnections: [{ id: "peer-1" }] }));
    sessionStorage.setItem("obscur_auth_token::profile-b", "token-b");

    const { ensureIdentityProfileBinding } = await import("./identity-profile-binding");
    const profileId = await ensureIdentityProfileBinding({
      publicKeyHex: record.publicKeyHex as any,
      username: record.username,
    });

    expect(profileId).toBe("profile-a");
    expect(mocks.ensureProfile).toHaveBeenCalledWith("profile-a", "Echo");
    expect(localStorage.getItem(`dweb.nostr.pwa.chatState.v2.${record.publicKeyHex}::profile-a`)).toContain("peer-1");
    expect(sessionStorage.getItem("obscur_auth_token::profile-a")).toBe("token-b");
    expect(mocks.switchProfile).not.toHaveBeenCalled();
  });

  it("remaps account-scoped local state into explicit profile slot even when identity binding was cleared", async () => {
    const publicKeyHex = "f".repeat(64) as any;
    mocks.getActiveProfileIdSafe.mockReturnValue("profile-a");
    mocks.getProfileScopeOverride.mockReturnValue("profile-a");
    localStorage.setItem(`dweb.nostr.pwa.chatState.v2.${publicKeyHex}::profile-b`, JSON.stringify({ createdConnections: [{ id: "peer-2" }] }));

    const { ensureIdentityProfileBinding } = await import("./identity-profile-binding");
    const profileId = await ensureIdentityProfileBinding({
      publicKeyHex,
      username: "Foxtrot",
    });

    expect(profileId).toBe("profile-a");
    expect(localStorage.getItem(`dweb.nostr.pwa.chatState.v2.${publicKeyHex}::profile-a`)).toContain("peer-2");
    expect(mocks.switchProfile).not.toHaveBeenCalled();
  });

  it("recovers the single stored identity by switching to its profile", async () => {
    const record: IdentityRecord = {
      encryptedPrivateKey: "cipher",
      publicKeyHex: "c".repeat(64),
      username: "Carol",
    };
    mocks.setEntries([{ key: "identity::pk-ccc", value: record }]);

    const { recoverSingleStoredIdentityProfile } = await import("./identity-profile-binding");
    const binding = await recoverSingleStoredIdentityProfile();

    expect(binding?.profileId).toBe("pk-ccc");
    expect(binding?.record.publicKeyHex).toBe(record.publicKeyHex);
    expect(mocks.ensureProfile).toHaveBeenCalledWith("pk-ccc", "Carol");
    expect(mocks.switchProfile).toHaveBeenCalledWith("pk-ccc");
  });

  it("recovers remembered profile identity when multiple bindings exist", async () => {
    const primaryRecord: IdentityRecord = {
      encryptedPrivateKey: "cipher-primary",
      publicKeyHex: "e".repeat(64),
      username: "Erin",
    };
    const secondaryRecord: IdentityRecord = {
      encryptedPrivateKey: "cipher-secondary",
      publicKeyHex: "f".repeat(64),
      username: "Frank",
    };
    mocks.setEntries([
      { key: "identity::profile-a", value: primaryRecord },
      { key: "identity::profile-b", value: secondaryRecord },
    ]);
    localStorage.setItem("obscur_remember_me::profile-b", "true");
    localStorage.setItem("obscur_auth_token::profile-b", "passphrase");

    const { recoverStoredIdentityProfile } = await import("./identity-profile-binding");
    const binding = await recoverStoredIdentityProfile();

    expect(binding?.profileId).toBe("profile-b");
    expect(binding?.record.publicKeyHex).toBe(secondaryRecord.publicKeyHex);
    expect(mocks.switchProfile).toHaveBeenCalledWith("profile-b");
  });
});
