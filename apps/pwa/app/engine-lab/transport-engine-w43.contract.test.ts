import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "../../../../");

const readFromRepo = (relFromRepoRoot: string): string => (
  readFileSync(join(REPO_ROOT, relFromRepoRoot), "utf8")
);

describe("transport-engine w43 — Rust network publish protocol wiring", () => {
  it("pins network protocol wiring charter", () => {
    const charter = readFromRepo("docs/program/transport-engine-w43-rust-network-publish-protocol-wiring.md");
    expect(charter).toContain("Rust Network Publish Protocol Wiring");
    expect(charter).toContain("publish_with_quorum_attempts");
    expect(charter).toContain("No writable relay connection");
  });

  it("implements protocol-backed network assembly in engine_invoke", () => {
    const rust = readFromRepo("packages/libobscur/src/engine_invoke.rs");
    expect(rust).toContain("assemble_transport_publish_relay_event_network");
    expect(rust).toContain("map_quorum_report_to_transport_publish_result");
    expect(rust).toContain("publish_with_quorum_attempts");
  });
});
