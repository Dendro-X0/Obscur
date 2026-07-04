import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "../../../../");

const readFromRepo = (relFromRepoRoot: string): string => (
  readFileSync(join(REPO_ROOT, relFromRepoRoot), "utf8")
);

describe("transport-engine w36 — Rust publish dry-run assembly charter (design-only)", () => {
  it("pins dry-run assembly charter without implementation", () => {
    const charter = readFromRepo("docs/program/transport-engine-w36-rust-publish-dry-run-assembly-charter.md");
    expect(charter).toContain("Rust Publish Dry-Run Assembly Charter");
    expect(charter).toContain("dry-run");
    expect(charter).toContain("design + contract only");
    expect(charter).toContain("transport_publish_not_wired");
  });

  it("asserts libobscur implements dry-run assembly after w37", () => {
    const rust = readFromRepo("packages/libobscur/src/engine_invoke.rs");
    expect(rust).toContain("assemble_transport_publish_relay_event_dry_run");
    expect(rust).toContain("transport_publish_dry_run");
  });
});
