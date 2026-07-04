import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ENGINE_LAB_SUBTRACTED_FILES } from "./legacy-subtraction-manifest";

const REPO_ROOT = join(__dirname, "../../../../");
const PWA_ROOT = join(REPO_ROOT, "apps/pwa");

const read = (relFromPwa: string): string => (
  readFileSync(join(PWA_ROOT, relFromPwa), "utf8")
);

const W28_SUBTRACTED_LEGACY = [
  "app/legacy/dm-conversation-projection-evidence-messages-legacy.ts",
  "app/legacy/dm-conversation-projection-live-merge-legacy.ts",
] as const;

const W28_FEATURE_CANONICAL = [
  {
    legacy: "app/legacy/dm-conversation-projection-evidence-messages-legacy.ts",
    feature: "app/features/messaging/services/thread-history/projection-evidence-messages.ts",
    exportName: "buildLegacyProjectionEvidenceMessagesForConversation",
  },
  {
    legacy: "app/legacy/dm-conversation-projection-live-merge-legacy.ts",
    feature: "app/features/messaging/services/thread-history/projection-live-merge.ts",
    exportName: "mergeLegacyProjectionFirstWithLiveOverlayForDisplay",
  },
] as const;

describe("legacy subtraction w28 — projection slices deleted from legacy", () => {
  it("projection legacy files are tombstoned in manifest", () => {
    for (const path of W28_SUBTRACTED_LEGACY) {
      expect(ENGINE_LAB_SUBTRACTED_FILES).toContain(path);
    }
  });

  it("projection legacy files stay deleted", () => {
    for (const path of W28_SUBTRACTED_LEGACY) {
      expect(existsSync(join(PWA_ROOT, path)), path).toBe(false);
    }
  });

  it("canonical projection modules live in thread-history without legacy imports", () => {
    for (const entry of W28_FEATURE_CANONICAL) {
      expect(existsSync(join(PWA_ROOT, entry.feature)), entry.feature).toBe(true);
      const source = read(entry.feature);
      expect(source).toContain(entry.exportName);
      expect(source).not.toMatch(/@\/app\/legacy\//);
    }
  });

  it("dm-thread-history-legacy-port re-exports projection from features", () => {
    const port = read("app/features/messaging/services/thread-history/dm-thread-history-legacy-port.ts");
    expect(port).toContain("./projection-evidence-messages");
    expect(port).toContain("./projection-live-merge");
    expect(port).not.toContain("dm-conversation-projection-evidence-messages-legacy");
    expect(port).not.toContain("dm-conversation-projection-live-merge-legacy");
  });

  it("thread-history adapters route projection through legacy port only", () => {
    const webAdapter = read("app/features/messaging/services/thread-history/dm-adapter.ts");
    expect(webAdapter).toContain("dm-thread-history-legacy-port");
    expect(webAdapter).not.toContain("dm-conversation-projection-evidence-messages-legacy");
    expect(webAdapter).not.toContain("dm-conversation-projection-live-merge-legacy");
  });
});
