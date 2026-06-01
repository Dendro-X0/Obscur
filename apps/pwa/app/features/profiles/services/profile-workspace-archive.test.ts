import { beforeEach, describe, expect, it } from "vitest";
import {
  buildProfileWorkspaceArchive,
  buildProfileWorkspaceArchiveFileName,
  importProfileWorkspaceArchiveIntoScope,
  parseProfileWorkspaceArchive,
} from "./profile-workspace-archive-service";
import { PROFILE_WORKSPACE_ARCHIVE_FORMAT } from "./profile-workspace-archive-contracts";
import {
  evaluateProfileWindowAccountContinuity,
  setLastBoundAccountPublicKeyHex,
} from "./profile-window-account-binding";

const PK_A = "a".repeat(64);
const PK_B = "b".repeat(64);

describe("profile workspace archive", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("collects scoped storage for a profile workspace", () => {
    localStorage.setItem("dweb.nostr.pwa.profile::work", JSON.stringify({ version: 1, profile: { username: "Alice" } }));
    sessionStorage.setItem("obscur_auth_token::work", "token");

    const archive = buildProfileWorkspaceArchive({
      profileId: "work",
      reason: "manual_export",
    });

    expect(archive?.format).toBe(PROFILE_WORKSPACE_ARCHIVE_FORMAT);
    expect(archive?.localStorageEntries).toHaveLength(1);
    expect(archive?.sessionStorageEntries).toHaveLength(1);
    expect(buildProfileWorkspaceArchiveFileName(archive!)).toMatch(/\.obscur-profile\.json$/);
  });

  it("imports archive entries into a different profile scope", () => {
    const archive = {
      version: 1 as const,
      format: PROFILE_WORKSPACE_ARCHIVE_FORMAT,
      profileId: "source",
      exportedAtUnixMs: Date.now(),
      reason: "logout" as const,
      localStorageEntries: [{ key: "dweb.nostr.pwa.profile::source", value: "{\"version\":1}" }],
      sessionStorageEntries: [],
    };

    const result = importProfileWorkspaceArchiveIntoScope(archive, "target");
    expect(result.importedLocalKeys).toBe(1);
    expect(localStorage.getItem("dweb.nostr.pwa.profile::target")).toBe("{\"version\":1}");
    expect(parseProfileWorkspaceArchive(JSON.stringify(archive))?.profileId).toBe("source");
  });
});

describe("profile window account binding", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("detects account changes within the same profile window", () => {
    setLastBoundAccountPublicKeyHex("default", PK_A as any);
    expect(evaluateProfileWindowAccountContinuity("default", PK_A as any).status).toBe("same_account");
    expect(evaluateProfileWindowAccountContinuity("default", PK_B as any).status).toBe("account_changed");
    expect(evaluateProfileWindowAccountContinuity("fresh", PK_B as any).status).toBe("initial_bind");
  });
});
