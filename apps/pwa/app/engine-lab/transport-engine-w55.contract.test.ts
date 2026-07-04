import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveTransportEngineStandaloneLegacyReadPath } from "./transport-engine-standalone-legacy-contract-read";

const REPO_ROOT = join(__dirname, "../../../../");
const PWA_ROOT = join(REPO_ROOT, "apps/pwa");

const readFromRepo = (relFromRepoRoot: string): string => (
  readFileSync(join(REPO_ROOT, relFromRepoRoot), "utf8")
);

const readFromPwa = (relFromPwa: string): string => (
  readFileSync(join(PWA_ROOT, relFromPwa), "utf8")
);

const DELETION_GATE_ITEMS = [
  "Decision: PASS",
  "verify:transport-engine-w54",
  "W48 maintainer gate",
  "W47 harness",
  "W56",
] as const;

describe("transport-engine w55 — standalone legacy deletion charter", () => {
  it("pins deletion charter with five-part gate", () => {
    const charter = readFromRepo(
      "docs/program/transport-engine-w55-standalone-legacy-deletion-charter.md",
    );
    expect(charter).toContain("Standalone Legacy Deletion Charter");
    expect(charter).toContain("design-only");
    expect(charter).toContain("transport-kernel-standalone-publish-legacy.ts");
    for (const item of DELETION_GATE_ITEMS) {
      expect(charter).toContain(item);
    }
  });

  it("links deletion gate to W54 sign-off template", () => {
    const charter = readFromRepo(
      "docs/program/transport-engine-w55-standalone-legacy-deletion-charter.md",
    );
    const template = readFromRepo("docs/handoffs/transport-engine-smoke-sign-off-template.md");
    expect(charter).toContain("transport-engine-smoke-sign-off-template.md");
    expect(template).toContain("Decision");
  });

  it("keeps legacy module and facade on disk", () => {
    expect(existsSync(join(PWA_ROOT, "app/features/transport-kernel/transport-kernel-standalone-publish-legacy.ts"))).toBe(true);
    expect(existsSync(join(PWA_ROOT, "app/features/transport-kernel/transport-kernel-standalone-publish.ts"))).toBe(true);

    const legacy = readFromPwa(resolveTransportEngineStandaloneLegacyReadPath(PWA_ROOT));
    expect(legacy).toContain("publishTransportKernelToRelayUrls");
  });

  it("keeps port fallback importing legacy module", () => {
    const port = readFromPwa("app/features/relays/hooks/relay-standalone-publish-port.ts");
    expect(port).toContain("transport-kernel-standalone-publish-legacy");
    expect(port).toContain("shouldRouteHostTransportPublish");
  });
});
