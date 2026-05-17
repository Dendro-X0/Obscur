import { beforeEach, describe, expect, it } from "vitest";
import { runProfileMigrationV088, hasProfileMigrationRunV088 } from "./profile-migration-service";

describe("profile-migration-service", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("migrates legacy privacy/profile keys into default scoped keys", async () => {
    localStorage.setItem("obscur.settings.privacy", JSON.stringify({ autoLockTimeout: 5 }));
    localStorage.setItem("dweb.nostr.pwa.profile", JSON.stringify({ version: 1, profile: { username: "alpha", avatarUrl: "", nip05: "", inviteCode: "" } }));

    const report = await runProfileMigrationV088();

    expect(report.backupCreated).toBe(true);
    expect(localStorage.getItem("obscur.settings.privacy::default")).toContain("autoLockTimeout");
    expect(localStorage.getItem("dweb.nostr.pwa.profile::default")).toContain("alpha");
    expect(hasProfileMigrationRunV088()).toBe(true);
  });

  it("is idempotent after first successful marker write", async () => {
    await runProfileMigrationV088();
    const snapshotCountBefore = Object.keys(localStorage).filter((key) => key.startsWith("obscur.migration.v088.snapshot")).length;

    const report = await runProfileMigrationV088();
    const snapshotCountAfter = Object.keys(localStorage).filter((key) => key.startsWith("obscur.migration.v088.snapshot")).length;

    expect(report.backupCreated).toBe(false);
    expect(snapshotCountAfter).toBe(snapshotCountBefore);
  });
});
