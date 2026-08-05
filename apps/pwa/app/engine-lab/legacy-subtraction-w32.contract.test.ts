import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ENGINE_LAB_SUBTRACTED_FILES } from "./legacy-subtraction-manifest";

const REPO_ROOT = join(__dirname, "../../../../");
const PWA_ROOT = join(REPO_ROOT, "apps/pwa");

describe("legacy subtraction w32 — hydrate read model deleted (Wave 3)", () => {
  it("hydrate read model legacy file is tombstoned in manifest", () => {
    expect(ENGINE_LAB_SUBTRACTED_FILES).toContain(
      "app/legacy/dm-conversation-hydrate-read-model-legacy.ts",
    );
  });

  it("hydrate read model implementation is deleted; types remain", () => {
    expect(existsSync(join(PWA_ROOT, "app/legacy/dm-conversation-hydrate-read-model-legacy.ts"))).toBe(false);
    expect(existsSync(join(PWA_ROOT, "app/features/messaging/services/thread-history/hydrate-read-model.ts"))).toBe(false);
    expect(existsSync(join(PWA_ROOT, "app/features/messaging/services/thread-history/hydrate-read-model-types.ts"))).toBe(true);
    expect(existsSync(join(PWA_ROOT, "app/features/messaging/services/thread-history/dm-thread-history-legacy-port.ts"))).toBe(false);
  });
});
