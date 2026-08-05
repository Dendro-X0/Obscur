import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ENGINE_LAB_SUBTRACTED_FILES } from "./legacy-subtraction-manifest";

const REPO_ROOT = join(__dirname, "../../../../");
const PWA_ROOT = join(REPO_ROOT, "apps/pwa");

describe("legacy subtraction w28 — projection helpers deleted (Wave 3)", () => {
  it("projection legacy files are tombstoned in manifest", () => {
    expect(ENGINE_LAB_SUBTRACTED_FILES).toContain(
      "app/legacy/dm-conversation-projection-evidence-messages-legacy.ts",
    );
  });

  it("projection implementation files are deleted from thread-history", () => {
    expect(existsSync(join(PWA_ROOT, "app/features/messaging/services/thread-history/projection-evidence-messages.ts"))).toBe(false);
    expect(existsSync(join(PWA_ROOT, "app/features/messaging/services/thread-history/projection-live-merge.ts"))).toBe(false);
    expect(existsSync(join(PWA_ROOT, "app/features/messaging/services/thread-history/dm-thread-history-legacy-port.ts"))).toBe(false);
  });

  it("dm-adapter remains stub without projection imports", () => {
    const webAdapter = readFileSync(
      join(PWA_ROOT, "app/features/messaging/services/thread-history/dm-adapter.ts"),
      "utf8",
    );
    expect(webAdapter).toContain("dmKernelThreadHistoryStub");
    expect(webAdapter).not.toContain("projection-evidence-messages");
    expect(webAdapter).not.toContain("projection-live-merge");
  });
});
