import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "../../../../");
const PWA_ROOT = join(REPO_ROOT, "apps/pwa");

const read = (relFromPwa: string): string => (
  readFileSync(join(PWA_ROOT, relFromPwa), "utf8")
);

describe("transport-engine w12 — standalone publish port gating", () => {
  it("transport-kernel publish port owns legacy publish gate", () => {
    const port = read("app/features/transport-kernel/transport-kernel-publish-port.ts");
    expect(port).toContain("shouldUseLegacyStandaloneRelayPublish");
    expect(port).toContain("isTransportKernelPublishOwner");
    expect(port).toContain("isTransportKernelAuthority");
    expect(port).toContain("hasNativeRuntime");
  });

  it("enhanced relay pool port exports standalone publish via publish port", () => {
    const port = read("app/features/relays/hooks/enhanced-relay-pool-port.ts");
    expect(port).toContain("relay-standalone-publish-port");
    expect(port).toContain("publishToUrlsStandalone");
    expect(port).toContain("publishToRelayStandalone");
  });

  it("invite-manager uses pool port publish and does not import legacy runtime directly", () => {
    const inviteManager = read("app/features/invites/utils/invite-manager.ts");
    expect(inviteManager).toContain("publishToUrlsStandalone");
    expect(inviteManager).toContain("enhanced-relay-pool-port");
    expect(inviteManager).not.toContain("enhanced-relay-pool-legacy");
  });
});

