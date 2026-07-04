import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "../../../../");

const readFromRepo = (relFromRepoRoot: string): string => (
  readFileSync(join(REPO_ROOT, relFromRepoRoot), "utf8")
);

describe("transport-engine w32 — Rust publish result assembly charter (design-only)", () => {
  it("pins result assembly charter without implementation", () => {
    const charter = readFromRepo("docs/program/transport-engine-w32-rust-publish-result-assembly-charter.md");
    expect(charter).toContain("Rust Publish Result Assembly Charter");
    expect(charter).toContain("TransportPublishRelayEventResult");
    expect(charter).toContain("design + contract only");
    expect(charter).toContain("transport_publish_not_wired");
  });

  it("asserts publishRelayEvent uses dry-run assembly without network I/O", () => {
    const rust = readFromRepo("packages/libobscur/src/engine_invoke.rs");
    expect(rust).toContain("assemble_transport_publish_relay_event_dry_run");
    expect(rust).toContain("TransportPublishRelayEventResult");
    expect(rust).not.toContain("send_relay_message");
  });
});
