import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  mapRichConversationToCanonical,
  mapRichMessageToCanonical,
} from "@obscur/protocol-nostr";

/**
 * P7 — first Obscur-Nostr body leaf lives in the package; adapter imports it.
 * @see specs/backend/platform-p7-obscur-nostr-body-extract-2026-11.md
 */
describe("platform P7 Obscur-Nostr body extract", () => {
  const repoRoot = path.resolve(__dirname, "../../../../../");
  const adapterSource = readFileSync(
    path.join(repoRoot, "apps/pwa/app/features/protocol-adaptation/nostr/nostr-adapter.ts"),
    "utf8",
  );
  const packageLeaf = readFileSync(
    path.join(repoRoot, "packages/obscur-protocol-nostr/src/canonical-from-rich.ts"),
    "utf8",
  );

  it("exports mappers from @obscur/protocol-nostr", () => {
    expect(typeof mapRichMessageToCanonical).toBe("function");
    expect(typeof mapRichConversationToCanonical).toBe("function");
  });

  it("adapter imports package mappers and does not redefine local toCanonical*", () => {
    expect(adapterSource).toContain('from "@obscur/protocol-nostr"');
    expect(adapterSource).toContain("mapRichMessageToCanonical");
    expect(adapterSource).toContain("mapRichConversationToCanonical");
    expect(adapterSource).not.toMatch(/const toCanonicalMessage\s*=/);
    expect(adapterSource).not.toMatch(/const toCanonicalConversation\s*=/);
  });

  it("package leaf has no app import paths", () => {
    expect(packageLeaf).not.toMatch(/from ["']@\/app\//);
    expect(packageLeaf).not.toMatch(/from ["'][^"']*apps\/pwa/);
  });
});
