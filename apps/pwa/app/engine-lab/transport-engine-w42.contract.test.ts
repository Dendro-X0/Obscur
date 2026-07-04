import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isTransportHostPublishNetworkEnvEnabled } from "@/app/features/transport-kernel/transport-kernel-publish-port";

const REPO_ROOT = join(__dirname, "../../../../");
const PWA_ROOT = join(REPO_ROOT, "apps/pwa");

const readFromRepo = (relFromRepoRoot: string): string => (
  readFileSync(join(REPO_ROOT, relFromRepoRoot), "utf8")
);

const readFromPwa = (relFromPwa: string): string => (
  readFileSync(join(PWA_ROOT, relFromPwa), "utf8")
);

describe("transport-engine w42 — Rust network publish lab gate", () => {
  it("pins network lab gate charter and env flag", () => {
    const charter = readFromRepo("docs/program/transport-engine-w42-rust-network-publish-lab-gate-charter.md");
    expect(charter).toContain("Rust Network Publish Lab Gate Charter");
    expect(charter).toContain("NEXT_PUBLIC_OBSCUR_TRANSPORT_HOST_PUBLISH_NETWORK");
    expect(charter).toContain("transport_publish_network_not_wired");
  });

  it("implements env-gated dispatch with protocol network + dry-run default", () => {
    const rust = readFromRepo("packages/libobscur/src/engine_invoke.rs");
    expect(rust).toContain("is_transport_host_publish_network_enabled");
    expect(rust).toContain("assemble_transport_publish_relay_event_network");
    expect(rust).toContain("assemble_transport_publish_relay_event_dry_run");
  });

  it("mirrors network env flag in transport-kernel-publish-port", () => {
    const policy = readFromPwa("app/features/transport-kernel/transport-kernel-publish-port.ts");
    expect(policy).toContain("isTransportHostPublishNetworkEnvEnabled");
    expect(isTransportHostPublishNetworkEnvEnabled()).toBe(false);
  });
});
