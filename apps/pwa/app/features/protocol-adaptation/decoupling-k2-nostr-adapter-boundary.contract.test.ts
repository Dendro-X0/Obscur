import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * K2 — messaging/shell must not import the nostr-adapter leaf.
 * Value + type imports go through `protocol-adaptation/layer` (or stay inside protocol-adaptation/).
 */
describe("decoupling K2 nostr-adapter boundary", () => {
  const featuresRoot = path.resolve(__dirname, "..");
  const protocolAdaptationRoot = path.resolve(__dirname);

  const collectTsFiles = (dir: string): string[] => {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) {
        if (entry === "node_modules") {
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
    const rel = path.relative(protocolAdaptationRoot, file);
    return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
  };

  /** Match `from "...nostr-adapter"` / `from '...nostr-adapter'` (shim or deep path). */
  const nostrAdapterFrom = /from\s+["'][^"']*nostr-adapter["']/;

  it("forbids nostr-adapter module imports outside protocol-adaptation/", () => {
    const violations: string[] = [];
    for (const file of collectTsFiles(featuresRoot)) {
      if (isUnderProtocolAdaptation(file)) {
        continue;
      }
      const source = readFileSync(file, "utf8");
      const lines = source.split("\n");
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index] ?? "";
        if (!nostrAdapterFrom.test(line)) {
          continue;
        }
        violations.push(`${path.relative(featuresRoot, file)}:${index + 1}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it("keeps layer as the sole owner that value-imports the nostr-adapter shim", () => {
    const layer = readFileSync(path.join(__dirname, "layer.ts"), "utf8");
    expect(layer).toMatch(/import\s+\{\s*nostrAdapter\s*\}\s+from\s+["']\.\/nostr-adapter["']/);
    expect(layer).toContain("sendDmNostrOnly");
  });
});
