/**
 * R2 contract — Vault page Secure Upload uses LES on native, not local-media-store.
 * @vitest-environment node
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("LES R2 Secure Upload wiring", () => {
  it("vault page prefers LES native surface", () => {
    const page = readFileSync(
      path.join(process.cwd(), "app/vault/vault-page-client.tsx"),
      "utf8",
    );
    expect(page).toContain("isLesNativeAvailable");
    expect(page).toContain("LesVaultPageBody");
    expect(page).toContain("LesUploadModal");
    expect(page).toContain("useLesVaultMedia");
    expect(page).not.toContain("LegacyVaultPageClient");
  });

  it("LES secure upload helper never imports local-media-store", () => {
    const upload = readFileSync(
      path.join(process.cwd(), "app/features/les/sdk/les-secure-upload.ts"),
      "utf8",
    );
    expect(upload).toContain("commitLesObjectWithProof");
    expect(upload).not.toContain("local-media-store");
    expect(upload).not.toContain("saveFileToLocalVault");
  });

  it("LES upload modal delegates to uploadFilesToLes", () => {
    const modal = readFileSync(
      path.join(process.cwd(), "app/features/les/ui/les-upload-modal.tsx"),
      "utf8",
    );
    expect(modal).toContain("uploadFilesToLes");
    expect(modal).not.toContain("saveFileToLocalVault");
  });
});
