import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string): string => (
  readFileSync(resolve(process.cwd(), relativePath), "utf8")
);

describe("vault chat save phase 6 contract → LES R4", () => {
  it("delegates chat save to LES catalog proof (legacy row-proof owner retired)", () => {
    const source = read("app/features/vault/services/save-chat-attachment-to-vault.ts");
    expect(source).toMatch(/saveChatAttachmentToLesWithOutcome/);
    expect(source).toMatch(/VAULT_SAVE_FROM_CHAT_ENABLED\s*=\s*false/);
    expect(source).toMatch(/isVaultSaveFromChatFeatureEnabled/);
    expect(source).not.toMatch(/awaitVaultIndexRowForKey/);
    expect(source).not.toMatch(/persistAttachmentToLocalVault/);
  });

  it("LES chat save commits with proof before success toast", () => {
    const les = read("app/features/les/sdk/les-chat-save.ts");
    expect(les).toMatch(/commitLesObjectWithProof/);
    expect(les).toMatch(/chat_save/);
  });

  it("documents LES redesign superseding phase 6 patch path", () => {
    const design = read("../../specs/backend/vault-les-radical-redesign-2026-07.md");
    expect(design).toMatch(/chat_save/);
    expect(design).toMatch(/Functional rewrite/);
  });
});
