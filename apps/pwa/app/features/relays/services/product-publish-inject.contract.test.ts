import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Product publish inject pin — desktop product must not wire browser pool.
 * @see specs/backend/backend-truth-map-and-publish-inject-design-2026-07.md
 */

const APP_ROOT = join(__dirname, "../../..");

const readApp = (relativePath: string): string => (
  readFileSync(join(APP_ROOT, relativePath), "utf8")
);

describe("product publish inject (mesh / transport-kernel)", () => {
  it("product UI pool hook is conduit mesh only", () => {
    const hookPort = readApp("features/relays/hooks/relay-pool-hook-port.ts");
    expect(hookPort).toContain("useConduitMeshRelayPool");
    expect(hookPort).not.toContain("relay-browser-pool-runtime");
    expect(hookPort).not.toContain("enhanced-relay-pool-legacy");
    expect(hookPort).not.toContain("useLegacyEnhancedRelayPool");
    expect(existsSync(join(APP_ROOT, "features/relays/hooks/enhanced-relay-pool-legacy.ts"))).toBe(false);
  });

  it("native never selects legacy browser standalone publish", () => {
    const port = readApp("features/transport-kernel/transport-kernel-publish-port.ts");
    expect(port).toMatch(
      /shouldUseLegacyStandaloneRelayPublish\s*=\s*\(\):\s*boolean\s*=>\s*false/,
    );
    expect(port).not.toContain("!isTransportKernelPublishOwner()");
    expect(port).not.toMatch(
      /shouldUseLegacyStandaloneRelayPublish\s*=\s*\(\):\s*boolean\s*=>\s*!hasNativeRuntime\(\)/,
    );
  });

  it("host publish shim/authority stay Dev Lab gated (product always closed)", () => {
    const port = readApp("features/transport-kernel/transport-kernel-publish-port.ts");
    expect(port).toContain("isDevLabEnabled()");
    expect(port).toContain("engine-lab/dev-lab-tombstone-policy");
    expect(port).toMatch(/shouldUseHostTransportPublishShim[\s\S]*isDevLabEnabled\(\)/);
    expect(port).toMatch(/shouldUseHostTransportPublishAuthority[\s\S]*isDevLabEnabled\(\)/);
    const policy = readApp("engine-lab/dev-lab-tombstone-policy.ts");
    expect(policy).toMatch(/isDevLabEnabled\s*=\s*\(\):\s*boolean\s*=>\s*false/);
  });

  it("browser pool runtime is labeled non-product residue", () => {
    const browser = readApp("features/relays/hooks/relay-browser-pool-runtime.ts");
    expect(browser).toContain("RUST-4c");
    expect(browser).toContain("useConduitMeshRelayPool");
  });
});
