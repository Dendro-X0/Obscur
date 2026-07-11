import { describe, expect, it } from "vitest";
import {
  enrichProfileSnapshotForRestore,
  mergeProfileSnapshotsForRestore,
  resolveRestoredProfileSnapshot,
} from "./restore-profile-merge";

const emptyProfile = {
  username: "",
  about: "",
  avatarUrl: "",
  nip05: "",
  inviteCode: "",
} as const;

describe("restore-profile-merge", () => {
  it("does not let empty incoming profile fields erase non-empty local profile data", () => {
    const merged = mergeProfileSnapshotsForRestore(
      {
        username: "Demouser",
        about: "Bio",
        avatarUrl: "https://example.com/a.png",
        nip05: "",
        inviteCode: "CODE-1",
      },
      emptyProfile,
    );

    expect(merged.username).toBe("Demouser");
    expect(merged.about).toBe("Bio");
    expect(merged.avatarUrl).toBe("https://example.com/a.png");
    expect(merged.inviteCode).toBe("CODE-1");
  });

  it("prefers non-empty incoming profile fields over local profile data", () => {
    const merged = mergeProfileSnapshotsForRestore(
      emptyProfile,
      {
        username: "Imported",
        about: "Imported bio",
        avatarUrl: "https://example.com/imported.png",
        nip05: "user@example.com",
        inviteCode: "CODE-2",
      },
    );

    expect(merged.username).toBe("Imported");
    expect(merged.about).toBe("Imported bio");
    expect(merged.avatarUrl).toBe("https://example.com/imported.png");
    expect(merged.nip05).toBe("user@example.com");
    expect(merged.inviteCode).toBe("CODE-2");
  });

  it("fills username from identity unlock when profile storage is empty", () => {
    const resolved = resolveRestoredProfileSnapshot(
      emptyProfile,
      emptyProfile,
      {
        encryptedPrivateKey: "encrypted-private-key-material",
        username: "Demouser",
      },
    );

    expect(resolved.username).toBe("Demouser");
  });

  it("fills username from export profile label when identity unlock is missing", () => {
    const resolved = enrichProfileSnapshotForRestore(emptyProfile, undefined, "DemoUser");
    expect(resolved.username).toBe("DemoUser");
  });

  it("keeps profile username when identity unlock is also present", () => {
    const resolved = enrichProfileSnapshotForRestore(
      {
        username: "SettingsName",
        about: "",
        avatarUrl: "",
        nip05: "",
        inviteCode: "",
      },
      {
        encryptedPrivateKey: "encrypted-private-key-material",
        username: "IdentityName",
      },
    );

    expect(resolved.username).toBe("SettingsName");
  });
});
