import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { useProfileInternals } from "@/app/features/profile/hooks/use-profile";
import { syncProfileDraftFromStoredIdentity } from "./profile-identity-draft-sync";

const publicKeyHex = "f".repeat(64) as PublicKeyHex;

vi.mock("@/app/features/auth/utils/get-stored-identity", () => ({
  getStoredIdentity: vi.fn(async () => ({
    record: {
      publicKeyHex,
      encryptedPrivateKey: "encrypted",
      username: "DemoUser",
    },
  })),
}));

vi.mock("@/app/features/auth/utils/identity-persistence", () => ({
  readIdentityRecordFromLocalStorage: vi.fn(() => undefined),
}));

vi.mock("@/app/features/profiles/services/profile-runtime-scope", () => ({
  getResolvedProfileId: vi.fn(() => "default"),
}));

describe("syncProfileDraftFromStoredIdentity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useProfileInternals.resetForTests();
    useProfileInternals.saveToStorage({
      profile: {
        username: "",
        about: "",
        avatarUrl: "",
        nip05: "",
        inviteCode: "",
      },
    });
  });

  it("copies identity username into empty profile storage", async () => {
    const synced = await syncProfileDraftFromStoredIdentity({ publicKeyHex });
    expect(synced).toBe(true);
    expect(useProfileInternals.loadFromStorage().profile.username).toBe("DemoUser");
  });

  it("does not overwrite an existing profile username", async () => {
    useProfileInternals.saveToStorage({
      profile: {
        username: "Existing",
        about: "",
        avatarUrl: "",
        nip05: "",
        inviteCode: "",
      },
    });
    const synced = await syncProfileDraftFromStoredIdentity({ publicKeyHex });
    expect(synced).toBe(false);
    expect(useProfileInternals.loadFromStorage().profile.username).toBe("Existing");
  });
});
