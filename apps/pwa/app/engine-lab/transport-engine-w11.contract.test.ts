import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "../../../../");
const PWA_ROOT = join(REPO_ROOT, "apps/pwa");

const read = (relFromPwa: string): string => (
  readFileSync(join(PWA_ROOT, relFromPwa), "utf8")
);

describe("transport-engine w11 — relay pool hook port subtraction", () => {
  it("transport-kernel pool hook port owns legacy subtraction gate", () => {
    const port = read("app/features/transport-kernel/transport-kernel-pool-hook-port.ts");
    expect(port).toContain("shouldUseLegacyRelayPoolHook");
    expect(port).toContain("isTransportKernelPoolHookOwner");
    expect(port).toContain("isTransportKernelAuthority");
  });

  it("use-relay-pool routes through relay-pool-hook-port not legacy hook directly", () => {
    const hook = read("app/features/relays/hooks/use-relay-pool.ts");
    expect(hook).toContain("relay-pool-hook-port");
    expect(hook).toContain("useRelayPoolRuntime");
    expect(hook).not.toContain("useLegacyEnhancedRelayPool");
    expect(hook).not.toContain("enhanced-relay-pool-port");
  });

  it("relay-pool-hook-port is sole UI importer of legacy pool hook", () => {
    const port = read("app/features/relays/hooks/relay-pool-hook-port.ts");
    expect(port).toContain("useLegacyEnhancedRelayPool");
    expect(port).toContain("useTransportKernelRelayPool");
    expect(port).toContain("shouldUseLegacyRelayPoolHook");
  });

  it("transport-kernel relay pool hook does not import useLegacyEnhancedRelayPool symbol", () => {
    const kernel = read("app/features/relays/hooks/use-transport-kernel-relay-pool.ts");
    expect(kernel).toContain("useTransportKernelRelayPool");
    expect(kernel).not.toContain("useLegacyEnhancedRelayPool");
    expect(kernel).toContain("use-enhanced-relay-pool-runtime");
  });
});
