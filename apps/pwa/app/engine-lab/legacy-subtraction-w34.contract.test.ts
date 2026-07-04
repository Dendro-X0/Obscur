import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ENGINE_LAB_SUBTRACTED_FILES } from "./legacy-subtraction-manifest";

const REPO_ROOT = join(__dirname, "../../../../");
const PWA_ROOT = join(REPO_ROOT, "apps/pwa");

const read = (relFromPwa: string): string => (
  readFileSync(join(PWA_ROOT, relFromPwa), "utf8")
);

describe("legacy subtraction w34 — hydrate pipeline deleted from legacy", () => {
  it("hydrate pipeline legacy file is tombstoned in manifest", () => {
    expect(ENGINE_LAB_SUBTRACTED_FILES).toContain(
      "app/legacy/dm-conversation-hydrate-pipeline-legacy.ts",
    );
  });

  it("hydrate pipeline legacy file stays deleted", () => {
    expect(existsSync(join(PWA_ROOT, "app/legacy/dm-conversation-hydrate-pipeline-legacy.ts"))).toBe(false);
  });

  it("canonical hydrate pipeline lives in features without legacy imports", () => {
    const source = read("app/features/messaging/services/dm-conversation-hydrate-pipeline.ts");
    expect(source).toContain("runLegacyDmConversationHydrateReadModelPipeline");
    expect(source).toContain("messaging-chat-state-read-port");
    expect(source).toContain("hydrate-indexed-legacy-port");
    expect(source).toContain("thread-history/hydrate-read-model");
    expect(source).not.toMatch(/@\/app\/legacy\//);
  });

  it("dm-conversation-hydrate-pipeline-port re-exports pipeline from features only", () => {
    const port = read("app/features/messaging/services/dm-conversation-hydrate-pipeline-port.ts");
    expect(port).toContain("./dm-conversation-hydrate-pipeline");
    expect(port).not.toMatch(/@\/app\/legacy\//);
    expect(port).not.toContain("dm-conversation-hydrate-pipeline-legacy");
  });

  it("thread-history legacy port routes hydrate pipeline through pipeline port", () => {
    const port = read("app/features/messaging/services/thread-history/dm-thread-history-legacy-port.ts");
    expect(port).toContain("dm-conversation-hydrate-pipeline-port");
    expect(port).not.toContain("dm-conversation-hydrate-pipeline-legacy");
  });
});
