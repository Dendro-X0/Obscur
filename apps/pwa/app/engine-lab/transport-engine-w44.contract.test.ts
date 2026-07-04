import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "../../../../");

const readFromRepo = (relFromRepoRoot: string): string => (
  readFileSync(join(REPO_ROOT, relFromRepoRoot), "utf8")
);

describe("transport-engine w44 — desktop relay pool injection charter", () => {
  it("pins relay pool injection charter", () => {
    const charter = readFromRepo(
      "docs/program/transport-engine-w44-desktop-relay-pool-injection-charter.md",
    );
    expect(charter).toContain("Desktop Relay Pool Injection Charter");
    expect(charter).toContain("RelayPool");
    expect(charter).toContain("publish_event_with_ack");
    expect(charter).toContain("assemble_transport_publish_relay_event_network_with_attempts");
  });

  it("keeps headless collector for sync engine_invoke network path", () => {
    const rust = readFromRepo("packages/libobscur/src/engine_invoke.rs");
    expect(rust).toContain("collect_headless_transport_publish_attempts");
    expect(rust).toContain("No writable relay connection");
  });

  it("preserves protocol_publish_with_quorum as existing relay surface", () => {
    const protocol = readFromRepo("apps/desktop/src-tauri/src/protocol.rs");
    expect(protocol).toContain("protocol_publish_with_quorum");
    expect(protocol).toContain("publish_event_with_ack");
  });
});
