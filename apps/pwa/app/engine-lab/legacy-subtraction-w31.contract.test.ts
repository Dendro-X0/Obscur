import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ENGINE_LAB_SUBTRACTED_FILES } from "./legacy-subtraction-manifest";

const REPO_ROOT = join(__dirname, "../../../../");
const PWA_ROOT = join(REPO_ROOT, "apps/pwa");

const W31_SUBTRACTED_LEGACY = [
  "app/legacy/dm-conversation-hydrate-indexed-scan-legacy.ts",
  "app/legacy/dm-conversation-hydrate-indexed-map-rows-legacy.ts",
] as const;

describe("legacy subtraction w31 — indexed scan/map deleted (Wave 3)", () => {
  it("indexed hydrate legacy files are tombstoned in manifest", () => {
    for (const path of W31_SUBTRACTED_LEGACY) {
      expect(ENGINE_LAB_SUBTRACTED_FILES).toContain(path);
    }
  });

  it("indexed hydrate implementation files are deleted", () => {
    for (const path of W31_SUBTRACTED_LEGACY) {
      expect(existsSync(join(PWA_ROOT, path)), path).toBe(false);
    }
    expect(existsSync(join(PWA_ROOT, "app/features/messaging/services/thread-history/hydrate-indexed-scan.ts"))).toBe(false);
    expect(existsSync(join(PWA_ROOT, "app/features/messaging/services/thread-history/hydrate-indexed-map-rows.ts"))).toBe(false);
    expect(existsSync(join(PWA_ROOT, "app/features/messaging/services/thread-history/hydrate-indexed-legacy-port.ts"))).toBe(false);
  });
});
