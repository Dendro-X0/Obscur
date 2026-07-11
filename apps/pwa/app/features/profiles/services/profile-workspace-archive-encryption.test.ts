/** @vitest-environment node */
import { webcrypto } from "node:crypto";
Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });

import { beforeEach, describe, expect, it, vi } from "vitest";
import { PROFILE_WORKSPACE_ARCHIVE_FORMAT } from "./profile-workspace-archive-contracts";
import {
  ProfileWorkspaceArchiveEncryptionRequiredError,
  writeProfileWorkspaceArchive,
} from "./profile-workspace-archive-service";
import { deriveProfileDataKeyMaterial } from "@/app/features/storage/services/profile-data-key";
import { getProfileStorageKeyMaterial } from "@/app/features/storage/services/profile-storage-key-session";

vi.mock("@/app/features/runtime/runtime-capabilities", () => ({
  hasNativeRuntime: vi.fn(() => true),
}));

vi.mock("@/app/features/runtime/native-adapters", () => ({
  invokeNativeCommand: vi.fn(async () => ({ ok: true, value: "/tmp/profile-archives/test.enc.json" })),
}));

vi.mock("@/app/features/storage/services/profile-storage-key-session", () => ({
  getProfileStorageKeyMaterial: vi.fn(() => null),
}));

const baseArchive = {
  version: 1 as const,
  format: PROFILE_WORKSPACE_ARCHIVE_FORMAT,
  profileId: "work",
  exportedAtUnixMs: 1_700_000_000_000,
  reason: "profile_removed" as const,
  localStorageEntries: [{ key: "dweb.nostr.pwa.profile::work", value: "{}" }],
  sessionStorageEntries: [],
};

describe("profile workspace archive encryption (KEY-MOAT Phase 5)", () => {
  beforeEach(() => {
    vi.mocked(getProfileStorageKeyMaterial).mockReturnValue(null);
  });

  it("refuses native removal archives without an active PDK session when scoped storage exists", async () => {
    await expect(writeProfileWorkspaceArchive(baseArchive)).rejects.toBeInstanceOf(
      ProfileWorkspaceArchiveEncryptionRequiredError,
    );
  });

  it("allows plaintext native removal archives for empty profile slots", async () => {
    const emptyArchive = {
      ...baseArchive,
      localStorageEntries: [],
      lastBoundPublicKeyHex: undefined,
    };
    const result = await writeProfileWorkspaceArchive(emptyArchive);
    expect(result.fileName).toMatch(/\.obscur-profile\.json$/);
    expect(result.fileName).not.toContain(".enc.");
  });

  it("writes encrypted native removal archives when PDK session is active", async () => {
    const keyMaterial = await deriveProfileDataKeyMaterial({
      passphrase: "Obscur-Phase3-Test-Vector!",
      profileId: "work",
    });
    vi.mocked(getProfileStorageKeyMaterial).mockReturnValue(keyMaterial);

    const result = await writeProfileWorkspaceArchive(baseArchive);
    expect(result.fileName).toContain(".obscur-profile.enc.json");
  });
});
