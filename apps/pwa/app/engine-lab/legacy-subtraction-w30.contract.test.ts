import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ENGINE_LAB_SUBTRACTED_FILES } from "./legacy-subtraction-manifest";

const REPO_ROOT = join(__dirname, "../../../../");
const PWA_ROOT = join(REPO_ROOT, "apps/pwa");

describe("legacy subtraction w30 — native thread hydrate deleted (Wave 3)", () => {
  it("native-dm-thread-hydrate-legacy is tombstoned in manifest", () => {
    expect(ENGINE_LAB_SUBTRACTED_FILES).toContain(
      "app/legacy/native-dm-thread-hydrate-legacy.ts",
    );
  });

  it("native hydrate implementation and adapter are deleted", () => {
    expect(existsSync(join(PWA_ROOT, "app/legacy/native-dm-thread-hydrate-legacy.ts"))).toBe(false);
    expect(existsSync(join(PWA_ROOT, "app/features/messaging/services/thread-history/native-dm-thread-hydrate.ts"))).toBe(false);
    expect(existsSync(join(PWA_ROOT, "app/features/messaging/services/thread-history/native-dm-adapter.ts"))).toBe(false);
  });

  it("dm-adapter is stub only", () => {
    const adapter = readFileSync(
      join(PWA_ROOT, "app/features/messaging/services/thread-history/dm-adapter.ts"),
      "utf8",
    );
    expect(adapter).toContain("dmKernelThreadHistoryStub");
    expect(adapter).not.toContain("native-dm-thread-hydrate");
  });
});
