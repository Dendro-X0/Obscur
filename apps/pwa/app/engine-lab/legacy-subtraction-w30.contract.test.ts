import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ENGINE_LAB_SUBTRACTED_FILES } from "./legacy-subtraction-manifest";

const REPO_ROOT = join(__dirname, "../../../../");
const PWA_ROOT = join(REPO_ROOT, "apps/pwa");

const read = (relFromPwa: string): string => (
  readFileSync(join(PWA_ROOT, relFromPwa), "utf8")
);

describe("legacy subtraction w30 — native thread hydrate deleted from legacy", () => {
  it("native-dm-thread-hydrate-legacy is tombstoned in manifest", () => {
    expect(ENGINE_LAB_SUBTRACTED_FILES).toContain(
      "app/legacy/native-dm-thread-hydrate-legacy.ts",
    );
  });

  it("legacy native thread hydrate file stays deleted", () => {
    expect(existsSync(join(PWA_ROOT, "app/legacy/native-dm-thread-hydrate-legacy.ts"))).toBe(false);
  });

  it("canonical native thread hydrate lives in thread-history without legacy imports", () => {
    const source = read("app/features/messaging/services/thread-history/native-dm-thread-hydrate.ts");
    expect(source).toContain("runLegacyNativeDmThreadHydrateReadModel");
    expect(source).toContain("hydrate-indexed-legacy-port");
    expect(source).not.toMatch(/@\/app\/legacy\//);
    expect(source).not.toContain("dm-read-authority-contract");
    expect(source).not.toContain("dm-conversation-hydrate-pipeline");
  });

  it("dm-thread-history-legacy-port re-exports native hydrate from features", () => {
    const port = read("app/features/messaging/services/thread-history/dm-thread-history-legacy-port.ts");
    expect(port).toContain("./native-dm-thread-hydrate");
    expect(port).not.toContain("native-dm-thread-hydrate-legacy");
  });

  it("native-dm-adapter routes hydrate through legacy port only", () => {
    const adapter = read("app/features/messaging/services/thread-history/native-dm-adapter.ts");
    expect(adapter).toContain("dm-thread-history-legacy-port");
    expect(adapter).not.toContain("native-dm-thread-hydrate-legacy");
  });
});
