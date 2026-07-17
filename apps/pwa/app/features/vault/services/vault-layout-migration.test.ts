/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/features/runtime/runtime-capabilities", () => ({
  hasNativeRuntime: () => true,
}));

vi.mock("@/app/features/storage/services/vault-at-rest", () => ({
  isVaultWriteEncryptionReady: () => true,
}));

vi.mock("@/app/features/profiles/services/profile-runtime-scope", () => ({
  getResolvedProfileId: () => "default",
}));

const localMediaStoreMocks = vi.hoisted(() => ({
  getLocalMediaIndexSnapshot: vi.fn(() => ({})),
  migrateLegacyVaultLayoutIndexEntry: vi.fn(async () => "migrated" as const),
}));

vi.mock("./local-media-store", () => ({
  getLocalMediaIndexSnapshot: localMediaStoreMocks.getLocalMediaIndexSnapshot,
  migrateLegacyVaultLayoutIndexEntry: localMediaStoreMocks.migrateLegacyVaultLayoutIndexEntry,
}));

import {
  listLegacyVaultLayoutIndexRemoteUrls,
  runVaultLayoutMigration,
} from "./vault-layout-migration";

describe("vault-layout-migration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localMediaStoreMocks.getLocalMediaIndexSnapshot.mockReturnValue({});
    localMediaStoreMocks.migrateLegacyVaultLayoutIndexEntry.mockResolvedValue("migrated");
  });

  it("lists legacy flat vault-media and Phase-5 flat profile vault rows", () => {
    localMediaStoreMocks.getLocalMediaIndexSnapshot.mockReturnValue({
      "vault://a": { relativePath: "vault-media/a.obscurvault" },
      "vault://b": { relativePath: "profiles/default/vault/b.obscurvault" },
      "vault://c": { relativePath: "profiles/default/vault/images/c.obscurvault" },
    });

    expect(listLegacyVaultLayoutIndexRemoteUrls()).toEqual(["vault://a", "vault://b"]);
  });

  it("migrates pending legacy layout rows on unlock", async () => {
    localMediaStoreMocks.getLocalMediaIndexSnapshot.mockReturnValue({
      "vault://a": { relativePath: "vault-media/a.obscurvault" },
    });

    const summary = await runVaultLayoutMigration();

    expect(summary.migrated).toBe(1);
    expect(localMediaStoreMocks.migrateLegacyVaultLayoutIndexEntry).toHaveBeenCalledWith("vault://a");
  });
});
