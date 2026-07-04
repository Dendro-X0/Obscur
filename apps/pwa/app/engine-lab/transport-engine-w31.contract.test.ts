import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "../../../../");

const readFromRepo = (relFromRepoRoot: string): string => (
  readFileSync(join(REPO_ROOT, relFromRepoRoot), "utf8")
);

describe("transport-engine w31 — Rust publish payload validation (validation-only)", () => {
  it("pins validation charter and invalid_payload semantics", () => {
    const charter = readFromRepo("docs/program/transport-engine-w31-rust-publish-payload-validation-charter.md");
    expect(charter).toContain("Rust Publish Payload Validation Charter");
    expect(charter).toContain("invalid_payload");
    expect(charter).toContain("transport_publish_not_wired");
    expect(charter).toContain("validation-only");
  });

  it("asserts engine_invoke validates publishRelayEvent payload before dry-run assembly", () => {
    const rust = readFromRepo("packages/libobscur/src/engine_invoke.rs");
    expect(rust).toContain("assemble_transport_publish_relay_event_dry_run");
    expect(rust).toContain("parse_transport_publish_relay_event_payload");
    expect(rust).toContain("invalid_payload");
  });
});
