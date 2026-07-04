import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { shouldUseHostTransportPublishShim } from "@/app/features/transport-kernel/transport-kernel-publish-port";
import {
  assertNetworkPublishParity,
  buildHostNetworkPublishResultFromAttempts,
  mapHostNetworkResultToMultiRelay,
  mapStandaloneAttemptsToMultiRelay,
} from "./transport-engine-network-publish-parity";
import { resolveTransportEngineStandaloneLegacyReadPath } from "./transport-engine-standalone-legacy-contract-read";

const REPO_ROOT = join(__dirname, "../../../../");
const PWA_ROOT = join(REPO_ROOT, "apps/pwa");

const readFromRepo = (relFromRepoRoot: string): string => (
  readFileSync(join(REPO_ROOT, relFromRepoRoot), "utf8")
);

const readFromPwa = (relFromPwa: string): string => (
  readFileSync(join(PWA_ROOT, relFromPwa), "utf8")
);

describe("transport-engine w47 — network publish parity harness charter", () => {
  it("pins network parity harness charter", () => {
    const charter = readFromRepo(
      "docs/program/transport-engine-w47-network-publish-parity-harness-charter.md",
    );
    expect(charter).toContain("Network Publish Parity Harness Charter");
    expect(charter).toContain("transport-kernel-standalone-publish.ts");
    expect(charter).toContain("publishHostTransportShimToRelayUrls");
    expect(charter).toContain("mapLegacyPublishResultToRelayPublishResult");
  });

  it("pins harness helpers and standalone owner baseline", () => {
    const harness = readFromPwa("app/engine-lab/transport-engine-network-publish-parity.ts");
    expect(harness).toContain("buildHostNetworkPublishResultFromAttempts");
    expect(harness).toContain("assertNetworkPublishParity");

    const standalone = readFromPwa(resolveTransportEngineStandaloneLegacyReadPath(PWA_ROOT));
    expect(standalone).toContain("publishTransportKernelToRelayUrls");
    expect(standalone).toContain("mapLegacyPublishResultToRelayPublishResult");

    const hostRouting = readFromRepo("packages/obscur-engine-host/src/tauri-engine-host.ts");
    expect(hostRouting).toContain("resolveTauriEngineInvokeCommand");
  });

  it("aligns fixture-level standalone vs host network parity", () => {
    const attempts = [
      { relayUrl: "wss://relay.one", success: false, error: "timeout" },
      { relayUrl: "wss://relay.two", success: false, error: "relay rejected" },
    ] as const;

    const standalone = mapStandaloneAttemptsToMultiRelay(attempts);
    const host = mapHostNetworkResultToMultiRelay(
      buildHostNetworkPublishResultFromAttempts(attempts),
    );

    assertNetworkPublishParity(standalone, host);
    expect(standalone.metQuorum).toBe(false);
  });

  it("keeps shim gate off by default", () => {
    expect(shouldUseHostTransportPublishShim()).toBe(false);
  });
});
