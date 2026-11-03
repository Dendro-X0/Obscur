import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  MATRIX_LAB_DISPLAY_NAME,
  OBSCUR_NOSTR_DISPLAY_NAME,
  OBSCUR_NOSTR_PACKAGE_NAME,
  PRIVATE_DC_DISPLAY_NAME,
  protocolDisplayName,
} from "./module-display-names";

/**
 * Platform rewrite band P5 — naming glossary L1 (no mass path rename).
 * @see specs/backend/platform-p5-naming-design-2026-11.md
 */
describe("platform P5 naming glossary", () => {
  const protocolRoot = path.resolve(__dirname);
  const repoRoot = path.resolve(__dirname, "../../../../../");

  it("exports glossary labels for selectable carriers", () => {
    expect(protocolDisplayName("nostr")).toBe(OBSCUR_NOSTR_DISPLAY_NAME);
    expect(protocolDisplayName("matrix")).toBe(MATRIX_LAB_DISPLAY_NAME);
    expect(protocolDisplayName("private_dc")).toBe(PRIVATE_DC_DISPLAY_NAME);
  });

  it("keeps @obscur/protocol-nostr package name stable", () => {
    const pkg = JSON.parse(
      readFileSync(path.join(repoRoot, "packages/obscur-protocol-nostr/package.json"), "utf8"),
    ) as { name: string; description: string };
    expect(pkg.name).toBe(OBSCUR_NOSTR_PACKAGE_NAME);
    expect(pkg.description).toContain("Obscur-Nostr");
  });

  it("Settings Protocols defaults come from module-display-names", () => {
    const panel = readFileSync(
      path.join(repoRoot, "apps/pwa/app/settings/panels/protocols-settings-tab-panel.tsx"),
      "utf8",
    );
    expect(panel).toContain("protocolDisplayName");
    expect(panel).toContain("module-display-names");
    expect(panel).not.toMatch(/PROTOCOL_DEFAULT_LABEL/);
  });

  it("documents the glossary in protocol-adaptation README", () => {
    const readme = readFileSync(path.join(protocolRoot, "README.md"), "utf8");
    expect(readme).toContain("Obscur-Nostr");
    expect(readme).toContain("Matrix (lab)");
    expect(readme).toContain("Private DC");
    expect(readme).toContain("platform-p5-naming-design-2026-11.md");
  });
});
