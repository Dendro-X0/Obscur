import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ENGINE_LAB_SUBTRACTED_FILES } from "./legacy-subtraction-manifest";

const REPO_ROOT = join(__dirname, "../../../../");
const PWA_ROOT = join(REPO_ROOT, "apps/pwa");

const read = (relFromPwa: string): string => (
  readFileSync(join(PWA_ROOT, relFromPwa), "utf8")
);

describe("legacy subtraction w39 — enhanced relay pool deleted from legacy", () => {
  it("enhanced relay pool legacy file is tombstoned in manifest", () => {
    expect(ENGINE_LAB_SUBTRACTED_FILES).toContain(
      "app/legacy/enhanced-relay-pool-legacy.ts",
    );
  });

  it("enhanced relay pool legacy file stays deleted", () => {
    expect(existsSync(join(PWA_ROOT, "app/legacy/enhanced-relay-pool-legacy.ts"))).toBe(false);
  });

  it("canonical relay pool lives in features without legacy imports", () => {
    const source = read("app/features/relays/hooks/enhanced-relay-pool-legacy.ts");
    expect(source).toContain("useLegacyEnhancedRelayPool");
    expect(source).toContain("publishToUrlsStandalone");
    expect(source).toContain("enhanced-relay-pool-types");
    expect(source).not.toMatch(/@\/app\/legacy\//);
  });

  it("enhanced-relay-pool-port re-exports pool from features only", () => {
    const port = read("app/features/relays/hooks/enhanced-relay-pool-port.ts");
    expect(port).toContain("./enhanced-relay-pool-legacy");
    expect(port).not.toMatch(/@\/app\/legacy\//);
    expect(port).not.toContain("@/app/legacy/enhanced-relay-pool-legacy");
  });

  it("use-relay-pool routes through relay-pool-hook-port", () => {
    const hook = read("app/features/relays/hooks/use-relay-pool.ts");
    expect(hook).toContain("relay-pool-hook-port");
    expect(hook).toContain("useRelayPoolRuntime");
    expect(hook).not.toContain("enhanced-relay-pool-legacy");
    expect(hook).not.toContain("@/app/legacy/enhanced-relay-pool-legacy");
  });
});
