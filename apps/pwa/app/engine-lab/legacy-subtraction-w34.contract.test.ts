import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ENGINE_LAB_SUBTRACTED_FILES } from "./legacy-subtraction-manifest";

const REPO_ROOT = join(__dirname, "../../../../");
const PWA_ROOT = join(REPO_ROOT, "apps/pwa");

const read = (relFromPwa: string): string => (
  readFileSync(join(PWA_ROOT, relFromPwa), "utf8")
);

describe("legacy subtraction w34 — hydrate pipeline deleted", () => {
  it("hydrate pipeline legacy file is tombstoned in manifest", () => {
    expect(ENGINE_LAB_SUBTRACTED_FILES).toContain(
      "app/legacy/dm-conversation-hydrate-pipeline-legacy.ts",
    );
  });

  it("hydrate pipeline legacy file stays deleted from app/legacy", () => {
    expect(existsSync(join(PWA_ROOT, "app/legacy/dm-conversation-hydrate-pipeline-legacy.ts"))).toBe(false);
  });

  it("features hydrate pipeline is deleted (R1 Wave 2)", () => {
    expect(existsSync(join(PWA_ROOT, "app/features/messaging/services/dm-conversation-hydrate-pipeline.ts"))).toBe(false);
    expect(existsSync(join(PWA_ROOT, "app/features/messaging/services/dm-conversation-hydrate-pipeline-port.ts"))).toBe(false);
  });

  it("dm-adapter is dm-kernel stub only", () => {
    const adapter = read("app/features/messaging/services/thread-history/dm-adapter.ts");
    expect(adapter).toContain("dmKernelThreadHistoryStub");
    expect(adapter).not.toContain("runLegacyDmConversationHydrateReadModelPipeline");
    expect(adapter).not.toMatch(/@\/app\/legacy\//);
  });

  it("thread-history legacy port deleted with pipeline (Wave 2/3)", () => {
    expect(existsSync(join(PWA_ROOT, "app/features/messaging/services/thread-history/dm-thread-history-legacy-port.ts"))).toBe(false);
  });
});
