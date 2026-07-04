import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "../../../../");

const readFromRepo = (relFromRepoRoot: string): string => (
  readFileSync(join(REPO_ROOT, relFromRepoRoot), "utf8")
);

const REQUIRED_SIGN_OFF_FIELDS = [
  "Commit hash",
  "Smoke date (UTC)",
  "verify:transport-engine-w53",
  "NEXT_PUBLIC_OBSCUR_TRANSPORT_HOST_PUBLISH_AUTHORITY",
  "NEXT_PUBLIC_OBSCUR_TRANSPORT_HOST_PUBLISH_NETWORK",
  "engine_invoke_transport_publish_relay_event",
  "Decision",
  "PASS",
  "BLOCKED",
] as const;

const W53_CHECKLIST_STEPS = [
  "verify:transport-engine-w52",
  "transport_kernel_host_publish_shim",
  "transport-kernel-standalone-publish-legacy",
] as const;

describe("transport-engine w54 — smoke evidence sign-off template charter", () => {
  it("pins sign-off template charter and template path", () => {
    const charter = readFromRepo(
      "docs/program/transport-engine-w54-smoke-evidence-sign-off-template-charter.md",
    );
    expect(charter).toContain("Smoke Evidence Sign-Off Template Charter");
    expect(charter).toContain("docs/handoffs/transport-engine-smoke-sign-off-template.md");
    expect(charter).toContain("design-only");
  });

  it("includes required sign-off fields in template", () => {
    const template = readFromRepo("docs/handoffs/transport-engine-smoke-sign-off-template.md");
    for (const field of REQUIRED_SIGN_OFF_FIELDS) {
      expect(template).toContain(field);
    }
    for (const step of W53_CHECKLIST_STEPS) {
      expect(template).toContain(step);
    }
  });

  it("links template to W53 smoke charter", () => {
    const charter = readFromRepo(
      "docs/program/transport-engine-w54-smoke-evidence-sign-off-template-charter.md",
    );
    const w53 = readFromRepo(
      "docs/program/transport-engine-w53-live-desktop-publish-smoke-charter.md",
    );
    expect(charter).toContain("W53");
    expect(w53).toContain("Sign-off");
  });

  it("does not record completed smoke PASS in current-session handoff", () => {
    const handoff = readFromRepo("docs/handoffs/current-session.md");
    expect(handoff).not.toMatch(/\*\*Decision:\*\* PASS/);
    expect(handoff).not.toContain("## W53 checklist results");
  });
});
