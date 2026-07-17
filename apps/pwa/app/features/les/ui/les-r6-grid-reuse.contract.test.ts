/**
 * R6 — Vault page reuses VaultMediaGrid with LES data plane (not useVaultMedia).
 * @vitest-environment node
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("LES R6 VaultMediaGrid reuse", () => {
  it("vault page wires VaultMediaGrid via useLesVaultMedia", () => {
    const page = readFileSync(
      path.join(process.cwd(), "app/vault/vault-page-client.tsx"),
      "utf8",
    );
    expect(page).toContain("VaultMediaGrid");
    expect(page).toContain("useLesVaultMedia");
    expect(page).toContain("LesUploadModal");
    expect(page).not.toContain("useVaultMedia");
    expect(page).not.toContain("LesCatalogGrid");
    expect(page).not.toContain("useLesCatalog");
  });

  it("LES vault media hook decrypts via LES SDK only", () => {
    const hook = readFileSync(
      path.join(process.cwd(), "app/features/les/ui/use-les-vault-media.ts"),
      "utf8",
    );
    expect(hook).toContain("listLesObjects");
    expect(hook).toContain("readLesObjectDecrypted");
    expect(hook).toContain("mapLesMetaToVaultMediaItem");
    expect(hook).not.toContain("vault-media-aggregator");
    expect(hook).not.toContain("scanMessagesForVaultMedia");
    expect(hook).not.toMatch(/\buseVaultMedia\b/);
  });

  it("VaultMediaGrid does not revoke preview blobs on lightbox close", () => {
    const grid = readFileSync(
      path.join(process.cwd(), "app/features/vault/components/vault-media-grid.tsx"),
      "utf8",
    );
    expect(grid).toContain("closePreview");
    expect(grid).not.toContain("revokeVaultMediaBlobUrl");
  });
});
