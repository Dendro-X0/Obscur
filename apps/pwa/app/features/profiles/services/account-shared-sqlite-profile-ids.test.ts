import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { listAccountSharedSqliteProfileIds } from "./account-shared-sqlite-profile-ids";
import { setLastBoundAccountPublicKeyHex } from "./profile-window-account-binding";

vi.mock("@/app/features/runtime/native-persistence-policy", () => ({
  requiresSqlitePersistence: vi.fn(() => true),
}));

vi.mock("./profile-registry-service", () => ({
  ProfileRegistryService: {
    getState: vi.fn(() => ({
      activeProfileId: "default",
      profiles: [
        { profileId: "default", label: "Default", createdAtUnixMs: 0, lastUsedAtUnixMs: 0, status: "active" },
        { profileId: "profile-secondary", label: "Secondary", createdAtUnixMs: 0, lastUsedAtUnixMs: 0, status: "inactive" },
        { profileId: "profile-other-account", label: "Other", createdAtUnixMs: 0, lastUsedAtUnixMs: 0, status: "inactive" },
      ],
    })),
  },
}));

import { requiresSqlitePersistence } from "@/app/features/runtime/native-persistence-policy";

const SHARED_ACCOUNT = "aa".repeat(32) as PublicKeyHex;

describe("listAccountSharedSqliteProfileIds", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(requiresSqlitePersistence).mockReturnValue(true);
  });

  it("returns only the primary profile id when account key is missing", () => {
    expect(listAccountSharedSqliteProfileIds({
      primaryProfileId: "profile-secondary",
      accountPublicKeyHex: null,
    })).toEqual(["profile-secondary"]);
  });

  it("returns every registered profile slot when account key is known (cross-slot hydrate)", () => {
    setLastBoundAccountPublicKeyHex("profile-secondary", SHARED_ACCOUNT);

    const profileIds = listAccountSharedSqliteProfileIds({
      primaryProfileId: "profile-secondary",
      accountPublicKeyHex: SHARED_ACCOUNT,
    });

    expect([...profileIds].sort()).toEqual([
      "default",
      "profile-other-account",
      "profile-secondary",
    ].sort());
  });

  it("returns only the primary profile id on web persistence", () => {
    vi.mocked(requiresSqlitePersistence).mockReturnValue(false);

    expect(listAccountSharedSqliteProfileIds({
      primaryProfileId: "profile-secondary",
      accountPublicKeyHex: SHARED_ACCOUNT,
    })).toEqual(["profile-secondary"]);
  });
});
