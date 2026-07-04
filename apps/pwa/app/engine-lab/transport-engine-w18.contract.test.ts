import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "../../../../");
const PWA_ROOT = join(REPO_ROOT, "apps/pwa");

const readFromRepo = (relFromRepoRoot: string): string => (
  readFileSync(join(REPO_ROOT, relFromRepoRoot), "utf8")
);

const readFromPwa = (relFromPwa: string): string => (
  readFileSync(join(PWA_ROOT, relFromPwa), "utf8")
);

describe("transport-engine w18 — non-wired host publish invoke surface", () => {
  it("transport engine host port exposes publishRelayEvent invoke helper", () => {
    const port = readFromPwa("app/features/transport-kernel/transport-engine-host-port.ts");
    expect(port).toContain("invokeTransportPublishRelayEvent");
    expect(port).toContain("buildTransportPublishRelayEventRequest");
    expect(port).toContain("transport_engine_host_unavailable");
  });

  it("libobscur transport dispatch recognizes publishRelayEvent but returns not wired", () => {
    const rust = readFromRepo("packages/libobscur/src/engine_invoke.rs");
    expect(rust).toContain("assemble_transport_publish_relay_event_dry_run");
  });

  it("desktop engine command remains the single invoke surface", () => {
    const command = readFromRepo("apps/desktop/src-tauri/src/commands/engine.rs");
    expect(command).toContain("dispatch");
    expect(command).toContain("EngineInvokeRequest");
    expect(command).toContain("engine_invoke");
  });
});

