/** @vitest-environment node */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(
  readFileSync(resolve(process.cwd(), "../../package.json"), "utf8"),
) as { scripts: Record<string, string> };
import {
  buildProfileWorkspaceArchiveFileName,
} from "@/app/features/profiles/services/profile-workspace-archive-service";
import {
  PROFILE_WORKSPACE_ARCHIVE_FORMAT,
  type ProfileWorkspaceArchive,
} from "@/app/features/profiles/services/profile-workspace-archive-contracts";
import { VAULT_ENCRYPTED_FILE_EXTENSION } from "./vault-at-rest";

describe("verify:storage-encryption-v1.9.8 contract", () => {
  it("package script chains storage-at-rest tests", () => {
    expect(packageJson.scripts["verify:storage-encryption-v1.9.8"]).toContain(
      "storage-at-rest-v1.9.8.test.ts",
    );
    expect(packageJson.scripts["verify:storage-encryption-v1.9.8"]).toContain("cargo build");
  });

  it("removal archives use encrypted filename when requested", () => {
    const archive: ProfileWorkspaceArchive = {
      version: 1,
      format: PROFILE_WORKSPACE_ARCHIVE_FORMAT,
      profileId: "default",
      exportedAtUnixMs: 1_700_000_000_000,
      reason: "profile_removed",
      localStorageEntries: [],
      sessionStorageEntries: [],
    };
    expect(buildProfileWorkspaceArchiveFileName(archive, true)).toContain(".obscur-profile.enc.json");
    expect(buildProfileWorkspaceArchiveFileName(archive, false)).toContain(".obscur-profile.json");
  });

  it("vault encrypted extension is opaque", () => {
    expect(VAULT_ENCRYPTED_FILE_EXTENSION).toBe(".obscurvault");
  });
});
