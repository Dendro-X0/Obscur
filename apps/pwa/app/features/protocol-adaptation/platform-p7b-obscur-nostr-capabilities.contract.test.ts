import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  formatNostrCanonicalSendRequiresCredentialsError,
  OBSCUR_NOSTR_CAPABILITIES,
} from "@obscur/protocol-nostr";

/**
 * P7b — capabilities leaf in package; adapter consumes it.
 * @see specs/backend/platform-p7b-obscur-nostr-capabilities-extract-2026-11.md
 */
describe("platform P7b Obscur-Nostr capabilities extract", () => {
  const repoRoot = path.resolve(__dirname, "../../../../../");
  const adapterSource = readFileSync(
    path.join(repoRoot, "apps/pwa/app/features/protocol-adaptation/nostr/nostr-adapter.ts"),
    "utf8",
  );
  const packageLeaf = readFileSync(
    path.join(repoRoot, "packages/obscur-protocol-nostr/src/capabilities.ts"),
    "utf8",
  );

  it("exports capabilities from @obscur/protocol-nostr", () => {
    expect(OBSCUR_NOSTR_CAPABILITIES.dms).toBe(true);
    expect(typeof formatNostrCanonicalSendRequiresCredentialsError).toBe("function");
  });

  it("adapter uses package capabilities and refuse helper", () => {
    expect(adapterSource).toContain("OBSCUR_NOSTR_CAPABILITIES");
    expect(adapterSource).toContain("formatNostrCanonicalSendRequiresCredentialsError");
    expect(adapterSource).not.toMatch(/capabilities:\s*\(\)\s*=>\s*\(\{[\s\S]*dms:\s*true/);
  });

  it("package leaf has no app import paths", () => {
    expect(packageLeaf).not.toMatch(/from ["']@\/app\//);
    expect(packageLeaf).not.toMatch(/from ["'][^"']*apps\/pwa/);
  });
});
