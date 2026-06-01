import { beforeEach, describe, expect, it } from "vitest";
import { buildProfileWorkspaceArchive } from "./profile-workspace-archive-service";
import { parseEncryptedWorkspaceBundleEnvelope } from "./encrypted-workspace-bundle-service";
import { ENCRYPTED_WORKSPACE_BUNDLE_FORMAT } from "./encrypted-workspace-bundle-contracts";

describe("encrypted workspace bundle envelope", () => {
  it("parses a valid envelope", () => {
    const envelope = {
      version: 1,
      format: ENCRYPTED_WORKSPACE_BUNDLE_FORMAT,
      profileId: "default",
      publicKeyHex: "a".repeat(64),
      exportedAtUnixMs: Date.now(),
      compression: "gzip+base64" as const,
      ciphertext: "cipher",
    };
    expect(parseEncryptedWorkspaceBundleEnvelope(envelope)?.profileId).toBe("default");
    expect(parseEncryptedWorkspaceBundleEnvelope({ ...envelope, format: "bad" })).toBeNull();
  });
});

describe("workspace archive in bundle payload", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("includes scoped profile storage in workspace archive", () => {
    localStorage.setItem("dweb.nostr.pwa.profile::work", JSON.stringify({ version: 1 }));
    const archive = buildProfileWorkspaceArchive({
      profileId: "work",
      reason: "manual_export",
    });
    expect(archive?.localStorageEntries).toHaveLength(1);
  });
});
