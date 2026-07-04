import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ENGINE_LAB_SUBTRACTED_FILES } from "./legacy-subtraction-manifest";

const REPO_ROOT = join(__dirname, "../../../../");
const PWA_ROOT = join(REPO_ROOT, "apps/pwa");

const read = (relFromPwa: string): string => (
  readFileSync(join(PWA_ROOT, relFromPwa), "utf8")
);

describe("legacy subtraction w27 — relay recovery deleted from legacy", () => {
  it("relay-recovery-policy-legacy is tombstoned in manifest", () => {
    expect(ENGINE_LAB_SUBTRACTED_FILES).toContain(
      "app/legacy/relay-recovery-policy-legacy.ts",
    );
  });

  it("legacy relay recovery file stays deleted", () => {
    expect(existsSync(join(PWA_ROOT, "app/legacy/relay-recovery-policy-legacy.ts"))).toBe(false);
  });

  it("canonical controller lives in features and delegates to transport-engine", () => {
    const controller = read("app/features/relays/services/relay-recovery-controller-legacy.ts");
    expect(controller).toContain("createWebLegacyRelayRecoveryController");
    expect(controller).toContain("buildTransportRecoverySnapshot");
    expect(controller).not.toContain("@/app/legacy/");
  });

  it("relay-recovery-port re-exports controller without legacy import", () => {
    const port = read("app/features/relays/services/relay-recovery-port.ts");
    expect(port).toContain("relay-recovery-controller-legacy");
    expect(port).not.toContain("relay-recovery-policy-legacy");
    expect(port).not.toMatch(/@\/app\/legacy\//);
  });

  it("relay runtime supervisor routes through relay-recovery-port", () => {
    const supervisor = read("app/features/relays/services/relay-runtime-supervisor.ts");
    expect(supervisor).toContain("relay-recovery-port");
    expect(supervisor).not.toContain("relay-recovery-policy-legacy");
  });
});
