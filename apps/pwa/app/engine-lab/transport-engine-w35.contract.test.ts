import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { shouldUseHostTransportPublishShim } from "@/app/features/transport-kernel/transport-kernel-publish-port";

const PWA_ROOT = join(__dirname, "../../../../apps/pwa");

const readFromPwa = (relFromPwa: string): string => (
  readFileSync(join(PWA_ROOT, relFromPwa), "utf8")
);

describe("transport-engine w35 — gated host publish port shim wiring", () => {
  it("wires opt-in host shim behind shouldUseHostTransportPublishShim", () => {
    const port = readFromPwa("app/features/relays/hooks/relay-standalone-publish-port.ts");
    expect(port).toContain("shouldRouteHostTransportPublish");
    expect(port).toContain("publishHostTransportShimToRelayUrls");
    expect(port).toContain("transport_kernel_host_publish_shim");

    const shim = readFromPwa("app/features/transport-kernel/transport-kernel-host-publish-shim.ts");
    expect(shim).toContain("publishRelayEventViaTransportEngineHost");
    expect(shim).toContain("mapLegacyPublishResultToRelayPublishResult");
  });

  it("keeps shim gate default off", () => {
    expect(shouldUseHostTransportPublishShim()).toBe(false);
  });
});
