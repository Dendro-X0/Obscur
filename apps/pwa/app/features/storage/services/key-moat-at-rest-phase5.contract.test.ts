/** @vitest-environment node */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  PROFILE_ARCHIVE_ENCRYPTION_REQUIRED_REASONS,
  requiresEncryptedProfileArchiveWrite,
} from "@/app/features/profiles/services/profile-workspace-archive-contracts";
import {
  encryptVaultBytesIfAvailable,
  VaultWriteEncryptionRequiredError,
} from "./vault-at-rest";

describe("KEY-MOAT Phase 5 — at-rest charter alignment", () => {
  it("vault deprecated helper no longer falls back to plaintext", async () => {
    await expect(
      encryptVaultBytesIfAvailable({ plaintext: new TextEncoder().encode("secret") }),
    ).rejects.toBeInstanceOf(VaultWriteEncryptionRequiredError);
  });

  it("removal archive reasons require encryption on native desktop", () => {
    expect(PROFILE_ARCHIVE_ENCRYPTION_REQUIRED_REASONS).toEqual([
      "profile_removed",
      "account_switch",
      "settings_clear_data",
      "settings_delete_account",
    ]);
    expect(requiresEncryptedProfileArchiveWrite("profile_removed")).toBe(true);
    expect(requiresEncryptedProfileArchiveWrite("manual_export")).toBe(false);
    expect(requiresEncryptedProfileArchiveWrite("logout")).toBe(false);
  });

  it("desktop SQLite uses .obscur-enc sidecar lock path", () => {
    const dbRs = readFileSync(
      resolve(process.cwd(), "../desktop/src-tauri/src/commands/db.rs"),
      "utf8",
    );
    expect(dbRs).toContain("unlock_with_key");
    expect(dbRs).toContain("lock_and_encrypt");
    expect(dbRs).toContain("encrypted_sidecar_path");
    expect(dbRs).toContain("obscur.sqlite3");
  });
});
