import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "../../../../");

const readFromRepo = (relFromRepoRoot: string): string => (
  readFileSync(join(REPO_ROOT, relFromRepoRoot), "utf8")
);

describe("transport-engine w37 — Rust publish dry-run assembly", () => {
  it("pins dry-run assembly in libobscur without network execution", () => {
    const rust = readFromRepo("packages/libobscur/src/engine_invoke.rs");
    expect(rust).toContain("assemble_transport_publish_relay_event_dry_run");
    expect(rust).toContain("transport_publish_dry_run");
    expect(rust).not.toContain("send_relay_message");
  });

  it("keeps invalid_payload validation before dry-run assembly", () => {
    const rust = readFromRepo("packages/libobscur/src/engine_invoke.rs");
    expect(rust).toContain("parse_transport_publish_relay_event_payload");
    expect(rust).toContain("invalid_payload");
  });
});
