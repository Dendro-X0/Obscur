import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PROTOCOL_IDS, SELECTABLE_PROTOCOL_IDS } from "./types";

/**
 * Platform rewrite band P4 — private_dc second carrier L1 spike.
 * @see specs/backend/platform-p4-second-carrier-design-2026-11.md
 */
describe("platform P4 private_dc second carrier", () => {
  const featuresRoot = path.resolve(__dirname, "..");
  const protocolRoot = path.resolve(__dirname);

  const collectTsFiles = (dir: string): string[] => {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) {
        if (entry === "node_modules" || entry === "dist") {
          continue;
        }
        out.push(...collectTsFiles(full));
        continue;
      }
      if (/\.(ts|tsx)$/.test(entry) && !entry.includes(".test.") && !entry.includes(".spec.")) {
        out.push(full);
      }
    }
    return out;
  };

  const isUnderProtocolAdaptation = (file: string): boolean => {
    const rel = path.relative(protocolRoot, file);
    return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
  };

  it("selects private_dc beside nostr and matrix", () => {
    expect(PROTOCOL_IDS).toContain("private_dc");
    expect(SELECTABLE_PROTOCOL_IDS).toContain("private_dc");
  });

  it("registers privateDcAdapter on the layer", () => {
    const layer = readFileSync(path.join(protocolRoot, "layer.ts"), "utf8");
    expect(layer).toContain('["private_dc", privateDcAdapter]');
    expect(layer).toContain("hasPrivateDcSession");
    expect(layer).toContain('activeProtocol === "private_dc"');
  });

  it("forbids private-dc-adapter imports outside protocol-adaptation/", () => {
    const privateDcFrom = /from\s+["'][^"']*private-dc-adapter["']/;
    const violations: string[] = [];
    for (const file of collectTsFiles(featuresRoot)) {
      if (isUnderProtocolAdaptation(file)) {
        continue;
      }
      // Settings may import session helpers only — adapter leaf stays layer-owned.
      const source = readFileSync(file, "utf8");
      if (privateDcFrom.test(source)) {
        violations.push(path.relative(featuresRoot, file));
      }
    }
    expect(violations).toEqual([]);
  });

  it("Settings Protocols exposes Private DC configure surface", () => {
    const panel = readFileSync(
      path.join(featuresRoot, "../settings/panels/protocols-settings-tab-panel.tsx"),
      "utf8",
    );
    expect(panel).toContain('data-testid="private-dc-config"');
    expect(panel).toContain("protocol-option-");
    expect(panel).toContain('"private_dc"');
    expect(panel).toContain("writePrivateDcSession");
    expect(panel).toContain("hasPrivateDcSession");
  });
});
