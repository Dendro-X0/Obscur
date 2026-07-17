/**
 * R4 — chat Save uses LES, not legacy vault store writes.
 * @vitest-environment node
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("LES R4 chat save wiring", () => {
  it("implements chat save against LES commit proof", () => {
    const source = readFileSync(
      path.join(process.cwd(), "app/features/les/sdk/les-chat-save.ts"),
      "utf8",
    );
    expect(source).toContain("commitLesObjectWithProof");
    expect(source).toContain('source: "chat_save"');
    expect(source).toContain("emitLesCatalogChanged");
    expect(source).not.toContain("saveFileToLocalVault");
    expect(source).not.toContain("awaitVaultIndexRowForKey");
  });

  it("facade delegates messaging APIs to LES", () => {
    const facade = readFileSync(
      path.join(process.cwd(), "app/features/vault/services/save-chat-attachment-to-vault.ts"),
      "utf8",
    );
    expect(facade).toContain("saveChatAttachmentToLesWithOutcome");
    expect(facade).toContain("VAULT_SAVE_FROM_CHAT_ENABLED = false");
    expect(facade).not.toContain("persistAttachmentToLocalVault");
  });
});
