import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isTransportHostPublishNetworkEnvEnabled,
  shouldRouteHostTransportPublish,
  shouldUseHostTransportPublishAuthority,
} from "@/app/features/transport-kernel/transport-kernel-publish-port";

const REPO_ROOT = join(__dirname, "../../../../");
const PWA_ROOT = join(REPO_ROOT, "apps/pwa");

const readFromRepo = (relFromRepoRoot: string): string => (
  readFileSync(join(REPO_ROOT, relFromRepoRoot), "utf8")
);

const readFromPwa = (relFromPwa: string): string => (
  readFileSync(join(PWA_ROOT, relFromPwa), "utf8")
);

const SMOKE_ENV_FLAGS = [
  "NEXT_PUBLIC_OBSCUR_TRANSPORT_HOST_PUBLISH_AUTHORITY",
  "NEXT_PUBLIC_OBSCUR_TRANSPORT_HOST_PUBLISH_NETWORK",
] as const;

describe("transport-engine w53 — live desktop publish smoke charter", () => {
  it("pins manual smoke charter with authority + network env matrix", () => {
    const charter = readFromRepo(
      "docs/program/transport-engine-w53-live-desktop-publish-smoke-charter.md",
    );
    expect(charter).toContain("Live Desktop Publish Smoke Charter");
    expect(charter).toContain("design-only");
    expect(charter).toContain("NEXT_PUBLIC_OBSCUR_TRANSPORT_HOST_PUBLISH_AUTHORITY");
    expect(charter).toContain("NEXT_PUBLIC_OBSCUR_TRANSPORT_HOST_PUBLISH_NETWORK");
    expect(charter).toContain("engine_invoke_transport_publish_relay_event");
    expect(charter).toContain("No automated smoke");
  });

  it("references W46 async routing and W50 authority port wiring", () => {
    const charter = readFromRepo(
      "docs/program/transport-engine-w53-live-desktop-publish-smoke-charter.md",
    );
    expect(charter).toContain("Phase D port host routing");

    const host = readFromRepo("packages/obscur-engine-host/src/tauri-engine-host.ts");
    expect(host).toContain("engine_invoke_transport_publish_relay_event");

    const port = readFromPwa("app/features/relays/hooks/relay-standalone-publish-port.ts");
    expect(port).toContain("shouldRouteHostTransportPublish");
    expect(port).toContain("transport_kernel_host_publish_shim");
  });

  it("keeps smoke gates off by default in contract tests", () => {
    for (const flag of SMOKE_ENV_FLAGS) {
      expect(process.env[flag]).not.toBe("1");
    }
    expect(shouldUseHostTransportPublishAuthority()).toBe(false);
    expect(isTransportHostPublishNetworkEnvEnabled()).toBe(false);
    expect(shouldRouteHostTransportPublish()).toBe(false);
  });

  it("does not add automated smoke tests in w53 wave", () => {
    const charter = readFromRepo(
      "docs/program/transport-engine-w53-live-desktop-publish-smoke-charter.md",
    );
    expect(charter).toContain("no Playwright");
    expect(charter).not.toContain("transport-engine-w53.smoke.test.ts");
  });
});
