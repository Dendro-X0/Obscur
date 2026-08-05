import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * relay-publish — clarify CodaCtrl heuristic dual-owner (study buckets A–E).
 * 2026-08: pool dual-path taxonomy close — aliases → mesh only; W64 deletion stays gated.
 * @see specs/backend/relay-publish-dual-owner-clarify-design-2026-07.md
 * @see specs/backend/relay-publish-dual-path-subtraction-design-2026-08.md
 */

const APP_ROOT = join(__dirname, "../../..");
const REPO_ROOT = join(APP_ROOT, "../../..");

const readApp = (relativePath: string): string => (
  readFileSync(join(APP_ROOT, relativePath), "utf8")
);

describe("relay-publish owner clarify contracts", () => {
  it("transport-kernel publish port exports the native owner gate", () => {
    const source = readApp("features/transport-kernel/transport-kernel-publish-port.ts");
    expect(source).toContain("export const isTransportKernelPublishOwner");
    expect(source).toContain("shouldUseLegacyStandaloneRelayPublish");
    // Browser-pool EVENT retired (2026-08) — gate always false.
    expect(source).toMatch(
      /shouldUseLegacyStandaloneRelayPublish\s*=\s*\(\):\s*boolean\s*=>\s*false/,
    );
    expect(source).not.toContain("!isTransportKernelPublishOwner()");
    expect(source).not.toMatch(
      /shouldUseLegacyStandaloneRelayPublish\s*=\s*\(\):\s*boolean\s*=>\s*!hasNativeRuntime\(\)/,
    );
    // Lab shim tombstone: Dev Lab gate required (always false on product).
    expect(source).toContain("isDevLabEnabled()");
  });

  it("legacy standalone publish ports remain named parallel paths (quarantine later)", () => {
    expect(existsSync(join(APP_ROOT, "features/relays/hooks/relay-standalone-publish-port.ts"))).toBe(true);
    expect(existsSync(join(APP_ROOT, "features/relays/hooks/relay-standalone-publish-port-subtracted.ts"))).toBe(true);
    const port = readApp("features/relays/hooks/relay-standalone-publish-port.ts");
    expect(port).toMatch(/shouldUseLegacyStandaloneRelayPublish|shouldRouteHostTransportPublish|isTransportKernelPublishOwner/);
  });

  it("community publish paths stay siloed (list-only while community PAUSED)", () => {
    expect(existsSync(join(APP_ROOT, "features/groups/services/local-workspace-relay-publish.ts"))).toBe(true);
    expect(existsSync(join(APP_ROOT, "features/groups/services/sealed-community-relay-publish-retry.ts"))).toBe(true);
  });

  it("freeze packages are outside pwa keep-set (do not treat as pwa EVENT owners)", () => {
    expect(existsSync(join(REPO_ROOT, "packages/obscur-conduit-mesh"))).toBe(true);
    expect(existsSync(join(REPO_ROOT, "apps/relay-gateway"))).toBe(true);
    // pwa must not re-home gateway EVENT ownership under features/relays
    expect(existsSync(join(APP_ROOT, "features/relays/services/relay-gateway-publish.ts"))).toBe(false);
  });

  it("RUST-4a: mesh failover gate demotes TS primary failover when mesh owns", () => {
    const gate = readApp("features/transport-kernel/mesh-scheduler-failover-gate.ts");
    expect(gate).toContain("setMeshSchedulerOwnsFailover");
    expect(gate).toContain("meshSchedulerOwnsFailover");
    const policy = readApp("features/relays/services/relay-primary-failover-policy.ts");
    expect(policy).toContain("meshSchedulerOwnsFailover");
    expect(policy).toMatch(/meshSchedulerOwnsFailover === true/);
    const apply = readApp("features/transport-kernel/apply-rust-mesh-configure.ts");
    expect(apply).toContain("setMeshSchedulerOwnsFailover");
  });

  it("RUST-4b/4c: legacy product file deleted; browser runtime is non-product only", () => {
    expect(existsSync(join(APP_ROOT, "features/relays/hooks/enhanced-relay-pool-legacy.ts"))).toBe(false);
    expect(existsSync(join(APP_ROOT, "features/relays/hooks/relay-browser-pool-runtime.ts"))).toBe(true);
    const browser = readApp("features/relays/hooks/relay-browser-pool-runtime.ts");
    expect(browser).toContain("RUST-4c");
    expect(browser).toContain("Product UI pool owner is `useConduitMeshRelayPool`");
    const poolHook = readApp("features/transport-kernel/transport-kernel-pool-hook-port.ts");
    expect(poolHook).toMatch(/shouldUseLegacyRelayPoolHook = \(\): boolean => false/);
    const hookPort = readApp("features/relays/hooks/relay-pool-hook-port.ts");
    expect(hookPort).toContain("useConduitMeshRelayPool");
    expect(hookPort).not.toContain("enhanced-relay-pool-legacy");
    expect(hookPort).not.toContain("useLegacyEnhancedRelayPool");
  });

  it("2026-08: pool dual-path aliases re-export useConduitMeshRelayPool only", () => {
    const enhanced = readApp("features/relays/hooks/use-enhanced-relay-pool-runtime.ts");
    const transport = readApp("features/relays/hooks/use-transport-kernel-relay-pool.ts");
    const legacyAlias = readApp("features/relays/hooks/enhanced-relay-pool-port.ts");

    expect(enhanced).toMatch(
      /export \{\s*useConduitMeshRelayPool as useEnhancedRelayPoolRuntime\s*\} from ["']\.\/use-conduit-mesh-relay-pool["']/,
    );
    expect(enhanced).not.toMatch(/publishToUrls|createEnhancedRelayPoolRuntime|WebSocket/);

    expect(transport).toMatch(
      /export \{\s*useConduitMeshRelayPool as useTransportKernelRelayPool\s*\} from ["']\.\/use-conduit-mesh-relay-pool["']/,
    );
    expect(transport).not.toMatch(/publishToUrls|createEnhancedRelayPoolRuntime|WebSocket/);

    expect(legacyAlias).toContain("useConduitMeshRelayPool as useLegacyEnhancedRelayPool");
    expect(legacyAlias).toContain('from "./use-conduit-mesh-relay-pool"');
  });

  it("2026-08: legacy pool hook selection stays permanently false", () => {
    const poolHook = readApp("features/transport-kernel/transport-kernel-pool-hook-port.ts");
    expect(poolHook).toMatch(/shouldUseLegacyRelayPoolHook = \(\): boolean => false/);
    expect(poolHook).not.toMatch(/shouldUseLegacyRelayPoolHook = \(\): boolean => true/);
  });
});
