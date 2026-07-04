import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "../../../../");

const readFromRepo = (relFromRepoRoot: string): string => (
  readFileSync(join(REPO_ROOT, relFromRepoRoot), "utf8")
);

describe("transport-engine w22 — Rust host publish wiring charter (design-only)", () => {
  it("pins the Rust wiring charter for publishRelayEvent", () => {
    const charter = readFromRepo("docs/program/transport-engine-w22-host-publish-rust-charter.md");
    expect(charter).toContain("Rust Host Publish Wiring Charter");
    expect(charter).toContain("transport_publish_not_wired");
    expect(charter).toContain("Non-goals / constraints for W22");
    expect(charter).toContain("design + contract only");
  });

  it("asserts that publishRelayEvent remains not wired in libobscur", () => {
    const rust = readFromRepo("packages/libobscur/src/engine_invoke.rs");
    expect(rust).toContain("assemble_transport_publish_relay_event_dry_run");
  });
});

