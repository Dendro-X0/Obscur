import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ENGINE_LAB_SUBTRACTED_FILES } from "./legacy-subtraction-manifest";

const REPO_ROOT = join(__dirname, "../../../../");
const PWA_ROOT = join(REPO_ROOT, "apps/pwa");

const read = (relFromPwa: string): string => (
  readFileSync(join(PWA_ROOT, relFromPwa), "utf8")
);

const W31_SUBTRACTED_LEGACY = [
  "app/legacy/dm-conversation-hydrate-indexed-scan-legacy.ts",
  "app/legacy/dm-conversation-hydrate-indexed-map-rows-legacy.ts",
] as const;

const W31_FEATURE_CANONICAL = [
  {
    legacy: "app/legacy/dm-conversation-hydrate-indexed-scan-legacy.ts",
    feature: "app/features/messaging/services/thread-history/hydrate-indexed-scan.ts",
    exportName: "loadLegacyInitialDmHydrationIndexedWindow",
  },
  {
    legacy: "app/legacy/dm-conversation-hydrate-indexed-map-rows-legacy.ts",
    feature: "app/features/messaging/services/thread-history/hydrate-indexed-map-rows.ts",
    exportName: "mapLegacyIndexedConversationRowsForDisplayableScan",
  },
] as const;

describe("legacy subtraction w31 — indexed scan/map deleted from legacy", () => {
  it("indexed hydrate legacy files are tombstoned in manifest", () => {
    for (const path of W31_SUBTRACTED_LEGACY) {
      expect(ENGINE_LAB_SUBTRACTED_FILES).toContain(path);
    }
  });

  it("indexed hydrate legacy files stay deleted", () => {
    for (const path of W31_SUBTRACTED_LEGACY) {
      expect(existsSync(join(PWA_ROOT, path)), path).toBe(false);
    }
  });

  it("canonical indexed scan/map modules live in thread-history without legacy imports", () => {
    for (const entry of W31_FEATURE_CANONICAL) {
      expect(existsSync(join(PWA_ROOT, entry.feature)), entry.feature).toBe(true);
      const source = read(entry.feature);
      expect(source).toContain(entry.exportName);
      expect(source).not.toMatch(/@\/app\/legacy\//);
    }
  });

  it("hydrate-indexed-legacy-port re-exports scan/map from features only", () => {
    const port = read("app/features/messaging/services/thread-history/hydrate-indexed-legacy-port.ts");
    expect(port).toContain("./hydrate-indexed-scan");
    expect(port).toContain("./hydrate-indexed-map-rows");
    expect(port).not.toMatch(/@\/app\/legacy\//);
    expect(port).not.toContain("dm-conversation-hydrate-indexed-scan-legacy");
    expect(port).not.toContain("dm-conversation-hydrate-indexed-map-rows-legacy");
  });

  it("hydrate pipeline legacy routes indexed helpers through hydrate-indexed-legacy-port", () => {
    const pipeline = read("app/features/messaging/services/dm-conversation-hydrate-pipeline.ts");
    expect(pipeline).toContain("hydrate-indexed-legacy-port");
    expect(pipeline).not.toContain("dm-conversation-hydrate-indexed-scan-legacy");
    expect(pipeline).not.toContain("dm-conversation-hydrate-indexed-map-rows-legacy");
  });
});
