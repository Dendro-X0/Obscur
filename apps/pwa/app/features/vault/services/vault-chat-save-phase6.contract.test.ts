import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string): string => (
  readFileSync(resolve(process.cwd(), relativePath), "utf8")
);

describe("vault chat save phase 6 contract", () => {
  it("uses row-proof gate and native fetch before success toast", () => {
    const source = read("app/features/vault/services/save-chat-attachment-to-vault.ts");
    expect(source).toMatch(/awaitVaultIndexRowForKey/);
    expect(source).toMatch(/fetchRemoteAttachmentBytesForVaultSave/);
    expect(source).toMatch(/VAULT_SAVE_FROM_CHAT_ENABLED\s*=\s*false/);
    expect(source).toMatch(/isVaultSaveFromChatFeatureEnabled/);
  });

  it("documents phase 6 design in specs", () => {
    const design = read("../../specs/backend/vault-chat-save-phase6-design-2026-07.md");
    expect(design).toMatch(/row-proof gate/);
    expect(design).toMatch(/awaitVaultIndexRowForKey/);
  });
});
