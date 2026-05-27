import { beforeEach, describe, expect, it } from "vitest";
import {
  getIdentityRecordStorageKey,
  listIdentityRecordsFromLocalStorage,
  readIdentityRecordFromLocalStorage,
  writeIdentityRecordToLocalStorage,
  removeIdentityRecordsForPublicKey,
  clearIdentityRecordsFromLocalStorage,
} from "./identity-persistence";

describe("identity-persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("reads and writes durable identity records per profile", () => {
    const record = {
      encryptedPrivateKey: "cipher",
      publicKeyHex: "a".repeat(64),
      username: "Alice",
    };
    writeIdentityRecordToLocalStorage({ profileId: "pk-owner", record });

    expect(readIdentityRecordFromLocalStorage("pk-owner")).toEqual(record);
    expect(localStorage.getItem(getIdentityRecordStorageKey("pk-owner"))).toContain("cipher");
  });

  it("lists bindings across profile scopes", () => {
    writeIdentityRecordToLocalStorage({
      profileId: "default",
      record: { encryptedPrivateKey: "c1", publicKeyHex: "a".repeat(64) },
    });
    writeIdentityRecordToLocalStorage({
      profileId: "pk-other",
      record: { encryptedPrivateKey: "c2", publicKeyHex: "b".repeat(64) },
    });

    expect(listIdentityRecordsFromLocalStorage()).toHaveLength(2);
  });

  it("removes duplicate pubkey bindings except the active profile", () => {
    const publicKeyHex = "a".repeat(64);
    writeIdentityRecordToLocalStorage({
      profileId: "default",
      record: { encryptedPrivateKey: "old", publicKeyHex },
    });
    writeIdentityRecordToLocalStorage({
      profileId: "pk-owner",
      record: { encryptedPrivateKey: "new", publicKeyHex },
    });

    removeIdentityRecordsForPublicKey({ publicKeyHex, keepProfileId: "pk-owner" });

    expect(readIdentityRecordFromLocalStorage("default")).toBeUndefined();
    expect(readIdentityRecordFromLocalStorage("pk-owner")?.encryptedPrivateKey).toBe("new");
  });

  it("clears scoped identity records", () => {
    writeIdentityRecordToLocalStorage({
      profileId: "profile-a",
      record: { encryptedPrivateKey: "cipher", publicKeyHex: "a".repeat(64) },
    });
    clearIdentityRecordsFromLocalStorage({ profileId: "profile-a" });
    expect(readIdentityRecordFromLocalStorage("profile-a")).toBeUndefined();
  });
});
