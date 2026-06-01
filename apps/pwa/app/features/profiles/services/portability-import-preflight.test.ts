import { describe, expect, it } from "vitest";
import { ENCRYPTED_WORKSPACE_BUNDLE_FORMAT } from "./encrypted-workspace-bundle-contracts";
import { preflightPortableAccountImport, preflightWorkspaceBundleImport } from "./portability-import-preflight";

const makeJsonFile = (value: unknown, name: string): File => ({
  name,
  text: async () => JSON.stringify(value),
} as File);

describe("portability import preflight", () => {
  it("rejects invalid portable account bundles", async () => {
    const file = makeJsonFile({}, "bad.json");
    const result = await preflightPortableAccountImport({
      file,
      activePublicKeyHex: "a".repeat(64) as never,
    });
    expect(result.canProceed).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("detects account mismatch for portable bundles", async () => {
    const bundle = {
      version: 1,
      format: "obscur.portable_account_bundle.v1",
      payloadVersion: 1,
      exportedAtUnixMs: Date.now(),
      publicKeyHex: "b".repeat(64),
      ciphertext: "cipher",
    };
    const file = makeJsonFile(bundle, "portable.json");
    const result = await preflightPortableAccountImport({
      file,
      activePublicKeyHex: "a".repeat(64) as never,
    });
    expect(result.accountMatch).toBe("mismatch");
    expect(result.canProceed).toBe(false);
  });

  it("parses workspace bundle envelope metadata", async () => {
    const envelope = {
      version: 1,
      format: ENCRYPTED_WORKSPACE_BUNDLE_FORMAT,
      profileId: "default",
      publicKeyHex: "a".repeat(64),
      exportedAtUnixMs: Date.now() - 60_000,
      compression: "gzip+base64",
      ciphertext: "cipher",
    };
    const file = makeJsonFile(envelope, "workspace.obscur-bundle");
    const result = await preflightWorkspaceBundleImport({
      file,
      activePublicKeyHex: "a".repeat(64) as never,
    });
    expect(result.accountMatch).toBe("match");
    expect(result.scopeItems.some((item) => item.label === "Profile window")).toBe(true);
  });
});
