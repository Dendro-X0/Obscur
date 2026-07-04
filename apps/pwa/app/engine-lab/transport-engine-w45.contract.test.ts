import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "../../../../");

const readFromRepo = (relFromRepoRoot: string): string => (
  readFileSync(join(REPO_ROOT, relFromRepoRoot), "utf8")
);

describe("transport-engine w45 — desktop async publish command", () => {
  it("pins async publish command charter", () => {
    const charter = readFromRepo(
      "docs/program/transport-engine-w45-desktop-async-publish-command-charter.md",
    );
    expect(charter).toContain("Desktop Async Publish Command Charter");
    expect(charter).toContain("engine_invoke_transport_publish_relay_event");
    expect(charter).toContain("assemble_transport_publish_relay_event_network_with_attempts");
  });

  it("exports attempts assembly API from libobscur", () => {
    const rust = readFromRepo("packages/libobscur/src/engine_invoke.rs");
    expect(rust).toContain("pub fn assemble_transport_publish_relay_event_network_with_attempts");
    expect(rust).toContain("pub fn is_transport_host_publish_network_enabled");
  });

  it("registers async desktop command with relay pool wiring", () => {
    const command = readFromRepo("apps/desktop/src-tauri/src/commands/transport_engine.rs");
    expect(command).toContain("engine_invoke_transport_publish_relay_event");
    expect(command).toContain("RelayPool");
    expect(command).toContain("assemble_transport_publish_relay_event_network_with_attempts");
    expect(command).toContain("publish_event_with_ack");

    const lib = readFromRepo("apps/desktop/src-tauri/src/lib.rs");
    expect(lib).toContain("commands::transport_engine::engine_invoke_transport_publish_relay_event");

    const permissions = readFromRepo("apps/desktop/src-tauri/permissions/app.toml");
    expect(permissions).toContain("engine_invoke_transport_publish_relay_event");
  });
});
