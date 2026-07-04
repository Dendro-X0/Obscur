import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "../../../../");
const PWA_ROOT = join(REPO_ROOT, "apps/pwa");

const read = (relFromPwa: string): string => (
  readFileSync(join(PWA_ROOT, relFromPwa), "utf8")
);

const W24_LEGACY_TARGETS = [
  "enhanced-relay-pool-legacy",
  "relay-recovery-policy-legacy",
] as const;

const W24_ROUTED_PRODUCTION_PATHS = [
  "app/features/relays/hooks/use-relay-pool.ts",
  "app/features/invites/utils/invite-manager.ts",
  "app/features/relays/services/relay-runtime-supervisor.ts",
] as const;

describe("legacy subtraction w24 — transport relay ports", () => {
  it("w24 production paths do not import w24 legacy targets directly", () => {
    for (const relativePath of W24_ROUTED_PRODUCTION_PATHS) {
      const source = read(relativePath);
      for (const target of W24_LEGACY_TARGETS) {
        expect(source, `${relativePath} must not import ${target}`).not.toContain(target);
      }
    }
  });

  it("relay pool hook routes through relay-pool-hook-port", () => {
    const hook = read("app/features/relays/hooks/use-relay-pool.ts");
    expect(hook).toContain("relay-pool-hook-port");
    expect(hook).toContain("useRelayPoolRuntime");
    expect(hook).not.toContain("enhanced-relay-pool-legacy");
    expect(hook).not.toContain("@/app/legacy/enhanced-relay-pool-legacy");
  });

  it("invite transport publish routes through enhanced-relay-pool-port", () => {
    const invite = read("app/features/invites/utils/invite-manager.ts");
    expect(invite).toContain("enhanced-relay-pool-port");
    expect(invite).toContain("publishToUrlsStandalone");
    expect(invite).not.toContain("enhanced-relay-pool-legacy");
  });

  it("relay runtime supervisor uses relay-recovery-port and typed recovery contracts", () => {
    const supervisor = read("app/features/relays/services/relay-runtime-supervisor.ts");
    expect(supervisor).toContain("relay-recovery-port");
    expect(supervisor).toContain("relay-recovery-types");
    expect(supervisor).not.toContain("relay-recovery-policy-legacy");
  });

  it("relay recovery types facade delegates to transport-engine", () => {
    const types = read("app/features/relays/services/relay-recovery-types.ts");
    expect(types).toContain("@obscur/transport-engine");
    expect(types).toContain("classifyTransportReadiness");
  });
});
