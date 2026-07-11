import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  buildAccountDisplayHintsByPublicKey,
  enrichDesktopProfilePreview,
  hasSavedAccountPickerPresence,
} from "./desktop-profile-preview-enrichment";
import { setLastBoundAccountPublicKeyHex } from "./profile-window-account-binding";

const PK_A = "a".repeat(64) as import("@dweb/crypto/public-key-hex").PublicKeyHex;
const PK_B = "b".repeat(64) as import("@dweb/crypto/public-key-hex").PublicKeyHex;

describe("desktop-profile-preview-enrichment", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("shares username hints across profile slots for the same bound account", () => {
    localStorage.setItem(
      "dweb.nostr.pwa.profile::default",
      JSON.stringify({ version: 1, profile: { username: "Tester1", avatarUrl: "https://example.com/1.png" } }),
    );
    setLastBoundAccountPublicKeyHex("default", PK_A);

    localStorage.setItem(
      "dweb.nostr.pwa.profile::profile-2",
      JSON.stringify({ version: 1, profile: { username: "", avatarUrl: "" } }),
    );
    setLastBoundAccountPublicKeyHex("profile-2", PK_A);

    const hints = buildAccountDisplayHintsByPublicKey();
    const enriched = enrichDesktopProfilePreview(
      "profile-2",
      { username: "", avatarUrl: "", publicKeyHex: PK_A },
      hints,
    );

    expect(enriched.username).toBe("Tester1");
    expect(enriched.avatarUrl).toBe("https://example.com/1.png");
  });

  it("uses registry label when profile draft and identity username are empty", () => {
    const hints = new Map<string, { username: string; avatarUrl: string }>();
    const enriched = enrichDesktopProfilePreview(
      "profile-2",
      { username: "", avatarUrl: "", publicKeyHex: PK_B },
      hints,
      "Tester2",
    );
    expect(enriched.username).toBe("Tester2");
    expect(hasSavedAccountPickerPresence({
      profileId: "profile-2",
      username: enriched.username,
      publicKeyHex: PK_B,
    })).toBe(true);
  });

  it("treats saved profile drafts as picker account presence", () => {
    expect(hasSavedAccountPickerPresence({
      profileId: "profile-2",
      username: "Tester2",
    })).toBe(true);
    expect(hasSavedAccountPickerPresence({
      profileId: "profile-2",
      username: "Profile 2",
    })).toBe(false);
    expect(hasSavedAccountPickerPresence({
      profileId: "profile-2",
      username: "",
      publicKeyHex: PK_B,
    })).toBe(true);
    expect(hasSavedAccountPickerPresence({
      profileId: "profile-4",
      username: "Restore backup",
    })).toBe(false);
    expect(hasSavedAccountPickerPresence({
      profileId: "profile-5",
      username: "New identity",
    })).toBe(false);
  });
});
