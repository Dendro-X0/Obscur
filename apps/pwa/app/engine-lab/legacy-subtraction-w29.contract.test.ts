import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ENGINE_LAB_SUBTRACTED_FILES } from "./legacy-subtraction-manifest";

const REPO_ROOT = join(__dirname, "../../../../");
const PWA_ROOT = join(REPO_ROOT, "apps/pwa");

const read = (relFromPwa: string): string => (
  readFileSync(join(PWA_ROOT, relFromPwa), "utf8")
);

const W29_SUBTRACTED_LEGACY = [
  "app/legacy/dm-conversation-materialization-load-earlier-legacy.ts",
  "app/legacy/dm-conversation-materialization-realtime-legacy.ts",
] as const;

const W29_FEATURE_CANONICAL = [
  {
    legacy: "app/legacy/dm-conversation-materialization-load-earlier-legacy.ts",
    feature: "app/features/messaging/services/thread-history/materialization-load-earlier.ts",
    exportName: "loadLegacyEarlierDmConversationMessages",
  },
  {
    legacy: "app/legacy/dm-conversation-materialization-realtime-legacy.ts",
    feature: "app/features/messaging/services/thread-history/materialization-realtime.ts",
    exportName: "applyLegacyRealtimeBufferedEvents",
  },
] as const;

describe("legacy subtraction w29 — materialization slices deleted from legacy", () => {
  it("materialization legacy files are tombstoned in manifest", () => {
    for (const path of W29_SUBTRACTED_LEGACY) {
      expect(ENGINE_LAB_SUBTRACTED_FILES).toContain(path);
    }
  });

  it("materialization legacy files stay deleted", () => {
    for (const path of W29_SUBTRACTED_LEGACY) {
      expect(existsSync(join(PWA_ROOT, path)), path).toBe(false);
    }
  });

  it("canonical materialization modules live in thread-history without legacy imports", () => {
    for (const entry of W29_FEATURE_CANONICAL) {
      expect(existsSync(join(PWA_ROOT, entry.feature)), entry.feature).toBe(true);
      const source = read(entry.feature);
      expect(source).toContain(entry.exportName);
      expect(source).not.toMatch(/@\/app\/legacy\//);
    }
  });

  it("load-earlier routes indexed scan through hydrate-indexed-legacy-port", () => {
    const source = read("app/features/messaging/services/thread-history/materialization-load-earlier.ts");
    expect(source).toContain("hydrate-indexed-legacy-port");
    expect(source).not.toContain("dm-conversation-materialization-load-earlier-legacy");
  });

  it("dm-thread-history-legacy-port re-exports materialization from features", () => {
    const port = read("app/features/messaging/services/thread-history/dm-thread-history-legacy-port.ts");
    expect(port).toContain("./materialization-load-earlier");
    expect(port).toContain("./materialization-realtime");
    expect(port).toContain("./hydrate-indexed-legacy-port");
    expect(port).not.toContain("dm-conversation-materialization-load-earlier-legacy");
    expect(port).not.toContain("dm-conversation-materialization-realtime-legacy");
  });

  it("thread-history adapters route materialization through legacy port only", () => {
    const webAdapter = read("app/features/messaging/services/thread-history/dm-adapter.ts");
    const nativeAdapter = read("app/features/messaging/services/thread-history/native-dm-adapter.ts");
    expect(webAdapter).toContain("dm-thread-history-legacy-port");
    expect(nativeAdapter).toContain("dm-thread-history-legacy-port");
    expect(webAdapter).not.toContain("dm-conversation-materialization-load-earlier-legacy");
    expect(webAdapter).not.toContain("dm-conversation-materialization-realtime-legacy");
  });
});
