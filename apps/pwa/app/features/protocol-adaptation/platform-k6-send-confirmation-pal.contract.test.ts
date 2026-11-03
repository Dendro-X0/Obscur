import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Platform rewrite band K6 — SendConfirmation public path is PAL, not nostr-adapter.
 * @see specs/backend/platform-k6-send-confirmation-pal-design-2026-11.md
 */
describe("platform K6 SendConfirmation PAL export", () => {
  const protocolRoot = path.resolve(__dirname);
  const featuresRoot = path.resolve(__dirname, "..");

  const collectTs = (dir: string): string[] => {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) {
        if (entry === "node_modules" || entry === "dist") {
          continue;
        }
        out.push(...collectTs(full));
        continue;
      }
      if (/\.(ts|tsx)$/.test(entry) && !entry.includes(".test.") && !entry.includes(".spec.")) {
        out.push(full);
      }
    }
    return out;
  };

  it("layer re-exports SendConfirmation from send-confirmation, not nostr-adapter", () => {
    const layer = readFileSync(path.join(protocolRoot, "layer.ts"), "utf8");
    expect(layer).toMatch(/from ["']\.\/send-confirmation["']/);
    expect(layer).toContain("SendConfirmation");
    expect(layer).not.toMatch(/export type \{[^}]*SendConfirmation[^}]*\} from ["']\.\/nostr-adapter["']/);
  });

  it("send-confirmation owns the pipeline type bridge", () => {
    const bridge = readFileSync(path.join(protocolRoot, "send-confirmation.ts"), "utf8");
    expect(bridge).toContain("SendConfirmation");
    expect(bridge).toContain("dm-send-pipeline");
    expect(bridge).toContain("K6");
  });

  it("messaging does not import SendConfirmation from nostr-adapter", () => {
    const messagingRoot = path.join(featuresRoot, "messaging");
    const nostrAdapterTypeImport = /import\s+type\s*\{[^}]*SendConfirmation[^}]*\}\s*from\s*["'][^"']*nostr-adapter["']/;
    const nostrAdapterValueImport = /import\s*\{[^}]*SendConfirmation[^}]*\}\s*from\s*["'][^"']*nostr-adapter["']/;
    const violations: string[] = [];
    for (const file of collectTs(messagingRoot)) {
      const source = readFileSync(file, "utf8");
      if (nostrAdapterTypeImport.test(source) || nostrAdapterValueImport.test(source)) {
        violations.push(path.relative(featuresRoot, file));
      }
    }
    expect(violations).toEqual([]);
  });
});
