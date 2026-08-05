import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Dev Lab product quarantine — shell must not mount / import lab bridges.
 * Phase 3: features/dev-lab deleted; policy lives in engine-lab.
 * @see specs/backend/dev-lab-phase3-deletion-design-2026-07.md
 */

const APP_ROOT = join(__dirname, "..");
const REPO_ROOT = join(APP_ROOT, "../../..");

const readApp = (relativePath: string): string => (
  readFileSync(join(APP_ROOT, relativePath), "utf8")
);

const readRepo = (relativePath: string): string => (
  readFileSync(join(REPO_ROOT, relativePath), "utf8")
);

describe("dev-lab product quarantine", () => {
  it("features/dev-lab tree is deleted", () => {
    expect(existsSync(join(APP_ROOT, "features/dev-lab"))).toBe(false);
  });

  it("AuthGateway does not mount or import Dev Lab bridges", () => {
    const source = readApp("features/auth/components/auth-gateway.tsx");
    expect(source).not.toContain("features/dev-lab");
    expect(source).not.toContain("DevLabAuthBridge");
    expect(source).not.toContain("DevLabMessagingBridge");
  });

  it("UnlockedAppRuntimeShell does not mount or import Dev Lab bridges", () => {
    const source = readApp("features/runtime/components/unlocked-app-runtime-shell.tsx");
    expect(source).not.toContain("features/dev-lab");
    expect(source).not.toContain("DevLabMessagingBridge");
    expect(source).not.toContain("DevLabAuthBridge");
  });

  it("product package scripts route lab entrypoints through tombstone", () => {
    const pkg = JSON.parse(readRepo("package.json")) as {
      scripts: Record<string, string>;
    };
    const tombstoned = [
      "dev:lab:run",
      "dev:lab:smoke",
      "dev:lab:benchmark",
      "dev:lab:full",
      "dev:lab:native-gate",
      "verify:tier3",
      "verify:tier3:full",
      "verify:trust-int-l3-devlab",
    ];
    for (const name of tombstoned) {
      expect(pkg.scripts[name], name).toContain("dev-lab-tombstone.mjs");
    }
  });

  it("tombstone policy remains permanently disabled", () => {
    const policy = readApp("engine-lab/dev-lab-tombstone-policy.ts");
    expect(policy).toContain("DEV_LAB_TOMBSTONED = true");
    expect(policy).toMatch(/isDevLabEnabled\s*=\s*\(\):\s*boolean\s*=>\s*false/);
  });
});
