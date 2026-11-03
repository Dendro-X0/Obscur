import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  getObscurNostrMigrationHints,
  getObscurNostrSwitchSummary,
  OBSCUR_NOSTR_DISPLAY_NAME,
} from "@obscur/protocol-nostr";
import {
  getProtocolMigrationHints,
  getProtocolSwitchSummary,
} from "./migration-hints";
import { protocolDisplayName } from "./module-display-names";

/**
 * P7c — Obscur-Nostr display + migration hints owned by the package.
 * @see specs/backend/platform-p7c-obscur-nostr-hints-display-2026-11.md
 */
describe("platform P7c Obscur-Nostr hints + display", () => {
  const repoRoot = path.resolve(__dirname, "../../../../../");
  const displayNames = readFileSync(
    path.join(repoRoot, "apps/pwa/app/features/protocol-adaptation/module-display-names.ts"),
    "utf8",
  );
  const migrationHints = readFileSync(
    path.join(repoRoot, "apps/pwa/app/features/protocol-adaptation/migration-hints.ts"),
    "utf8",
  );

  it("package owns display name and nostr hints", () => {
    expect(OBSCUR_NOSTR_DISPLAY_NAME).toBe("Obscur-Nostr");
    expect(getObscurNostrMigrationHints()[0]?.id).toBe("nostr-native-path");
    expect(getObscurNostrSwitchSummary()).toContain("Obscur-Nostr");
  });

  it("pwa reuses package for nostr display and hints", () => {
    expect(protocolDisplayName("nostr")).toBe(OBSCUR_NOSTR_DISPLAY_NAME);
    expect(getProtocolMigrationHints("nostr")).toEqual(getObscurNostrMigrationHints());
    expect(getProtocolSwitchSummary("nostr")).toBe(getObscurNostrSwitchSummary());
    expect(displayNames).toContain('from "@obscur/protocol-nostr"');
    expect(displayNames).not.toMatch(/export const OBSCUR_NOSTR_DISPLAY_NAME\s*=\s*"Obscur-Nostr"/);
    expect(migrationHints).toContain("getObscurNostrMigrationHints");
    expect(migrationHints).toContain("getObscurNostrSwitchSummary");
  });
});
