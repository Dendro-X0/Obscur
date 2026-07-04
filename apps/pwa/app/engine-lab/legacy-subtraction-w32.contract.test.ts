import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ENGINE_LAB_SUBTRACTED_FILES } from "./legacy-subtraction-manifest";

const REPO_ROOT = join(__dirname, "../../../../");
const PWA_ROOT = join(REPO_ROOT, "apps/pwa");

const read = (relFromPwa: string): string => (
  readFileSync(join(PWA_ROOT, relFromPwa), "utf8")
);

describe("legacy subtraction w32 — hydrate read model deleted from legacy", () => {
  it("hydrate read model legacy file is tombstoned in manifest", () => {
    expect(ENGINE_LAB_SUBTRACTED_FILES).toContain(
      "app/legacy/dm-conversation-hydrate-read-model-legacy.ts",
    );
  });

  it("hydrate read model legacy file stays deleted", () => {
    expect(existsSync(join(PWA_ROOT, "app/legacy/dm-conversation-hydrate-read-model-legacy.ts"))).toBe(false);
  });

  it("canonical hydrate read model lives in thread-history without legacy imports", () => {
    const source = read("app/features/messaging/services/thread-history/hydrate-read-model.ts");
    expect(source).toContain("assembleLegacyDmHydrateThreadReadModel");
    expect(source).toContain("dm-read-authority-port");
    expect(source).not.toMatch(/@\/app\/legacy\//);
  });

  it("dm-thread-history-legacy-port re-exports read model from features", () => {
    const port = read("app/features/messaging/services/thread-history/dm-thread-history-legacy-port.ts");
    expect(port).toContain("./hydrate-read-model");
    expect(port).not.toContain("dm-conversation-hydrate-read-model-legacy");
    expect(port).not.toMatch(/@\/app\/legacy\/.*read-model/);
  });

  it("hydrate pipeline legacy routes read model through features module", () => {
    const pipeline = read("app/features/messaging/services/dm-conversation-hydrate-pipeline.ts");
    expect(pipeline).toContain("thread-history/hydrate-read-model");
    expect(pipeline).not.toContain("dm-conversation-hydrate-read-model-legacy");
  });
});
