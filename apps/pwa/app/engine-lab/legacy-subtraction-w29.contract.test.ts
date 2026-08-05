import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ENGINE_LAB_SUBTRACTED_FILES } from "./legacy-subtraction-manifest";

const REPO_ROOT = join(__dirname, "../../../../");
const PWA_ROOT = join(REPO_ROOT, "apps/pwa");

describe("legacy subtraction w29 — materialization helpers deleted (Wave 3)", () => {
  it("materialization legacy files are tombstoned in manifest", () => {
    expect(ENGINE_LAB_SUBTRACTED_FILES).toContain(
      "app/legacy/dm-conversation-materialization-load-earlier-legacy.ts",
    );
    expect(ENGINE_LAB_SUBTRACTED_FILES).toContain(
      "app/legacy/dm-conversation-materialization-realtime-legacy.ts",
    );
  });

  it("materialization implementation files are deleted from thread-history", () => {
    expect(existsSync(join(PWA_ROOT, "app/features/messaging/services/thread-history/materialization-load-earlier.ts"))).toBe(false);
    expect(existsSync(join(PWA_ROOT, "app/features/messaging/services/thread-history/materialization-realtime.ts"))).toBe(false);
    expect(existsSync(join(PWA_ROOT, "app/features/messaging/services/thread-history/native-dm-adapter.ts"))).toBe(false);
  });

  it("dm-adapter remains stub without materialization imports", () => {
    const webAdapter = readFileSync(
      join(PWA_ROOT, "app/features/messaging/services/thread-history/dm-adapter.ts"),
      "utf8",
    );
    expect(webAdapter).toContain("dmKernelThreadHistoryStub");
    expect(webAdapter).not.toContain("materialization-load-earlier");
    expect(webAdapter).not.toContain("materialization-realtime");
  });
});
