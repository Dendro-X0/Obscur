import { beforeEach, describe, expect, it } from "vitest";
import {
  readProfileStoreUsername,
  resolveIdentityUsernameRepair,
  resolveUnlockAccountDisplayName,
} from "./resolve-unlock-account-display-name";

describe("resolveUnlockAccountDisplayName", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("prefers profile-store username over stale identity username", () => {
    localStorage.setItem(
      "dweb.nostr.pwa.profile::default",
      JSON.stringify({ version: 1, profile: { username: "Tester1" } }),
    );
    expect(resolveUnlockAccountDisplayName({
      profileId: "default",
      publicKeyHex: "e".repeat(64),
      identityUsername: "DemoUser",
    })).toBe("Tester1");
  });

  it("falls back to identity username when profile store is empty", () => {
    expect(resolveUnlockAccountDisplayName({
      profileId: "default",
      publicKeyHex: "e".repeat(64),
      identityUsername: "DemoUser",
    })).toBe("DemoUser");
  });

  it("readProfileStoreUsername returns empty when missing", () => {
    expect(readProfileStoreUsername("default")).toBe("");
  });

  it("resolveIdentityUsernameRepair returns profile name when identity disagrees", () => {
    expect(resolveIdentityUsernameRepair({
      profileId: "default",
      identityUsername: "DemoUser",
      profileStoreUsername: "Tester1",
    })).toBe("Tester1");
  });

  it("resolveIdentityUsernameRepair is null when names already match", () => {
    expect(resolveIdentityUsernameRepair({
      profileId: "default",
      identityUsername: "Tester1",
      profileStoreUsername: "Tester1",
    })).toBeNull();
  });
});
