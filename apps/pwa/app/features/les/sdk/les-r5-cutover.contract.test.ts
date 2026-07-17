import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(process.cwd(), "app");

const read = (rel: string): string => readFileSync(join(root, rel), "utf8");

describe("LES R5 cutover contracts", () => {
  it("vault page is LES data plane (no useVaultMedia catalog owner)", () => {
    const page = read("vault/vault-page-client.tsx");
    expect(page).toContain("isLesNativeAvailable");
    expect(page).toContain("LesUploadModal");
    expect(page).not.toContain("useVaultMedia");
    expect(page).not.toContain("LegacyVaultPageClient");
    expect(page).not.toContain("saveFileToLocalVault");
  });

  it("legacy vault write APIs are tombstoned", () => {
    const store = read("features/vault/services/local-media-store.ts");
    expect(store).toMatch(/Legacy saveFileToLocalVault retired \(LES R5\)/);
    expect(store).toMatch(/Legacy vault persist retired \(LES R5\)/);
    expect(store).toMatch(/explicitChatSave vault write retired \(LES R5\)/);
  });

  it("vault upload modal delegates to LES", () => {
    const modal = read("features/vault/components/vault-upload-modal.tsx");
    expect(modal).toContain("LesUploadModal");
    expect(modal).not.toContain("saveFileToLocalVault");
  });

  it("unlock maintenance no longer drives vault catalog migrations", () => {
    const storage = read("features/storage/services/native-storage-at-rest-service.ts");
    expect(storage).not.toContain("vault-media-index-sqlite-migration");
    const migration = read("features/vault/services/vault-media-index-sqlite-migration.ts");
    expect(migration).toMatch(/export const scheduleVaultUnlockMaintenance[\s\S]*no-op/);
  });

  it("chat save does not import vault write APIs", () => {
    const chat = read("features/les/sdk/les-chat-save.ts");
    expect(chat).toContain("les-attachment-fetch");
    expect(chat).not.toContain("saveFileToLocalVault");
    expect(chat).not.toContain("persistAttachmentToLocalVault");
  });
});
