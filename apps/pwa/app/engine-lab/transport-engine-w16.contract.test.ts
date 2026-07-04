import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "../../../../");
const PWA_ROOT = join(REPO_ROOT, "apps/pwa");

const readFromRepo = (relFromRepoRoot: string): string => (
  readFileSync(join(REPO_ROOT, relFromRepoRoot), "utf8")
);

const readFromPwa = (relFromPwa: string): string => (
  readFileSync(join(PWA_ROOT, relFromPwa), "utf8")
);

describe("transport-engine w16 — host publish charter decision", () => {
  it("captures explicit defer decision and migration plan in program charter", () => {
    const charter = readFromRepo("docs/program/transport-engine-w16-host-publish-charter.md");
    expect(charter).toContain("explicit defer");
    expect(charter).toContain("do not add");
    expect(charter).toContain("Migration plan");
    expect(charter).toContain("Exit criteria");
  });

  it("w16 charter explicitly deferred wiring a host publish implementation", () => {
    const charter = readFromRepo("docs/program/transport-engine-w16-host-publish-charter.md");
    expect(charter).toContain("do not add");
    expect(charter).toContain("host publish method");
    expect(charter).toContain("read-only in this wave");
  });

  it("native standalone publish owner remains transport-kernel path", () => {
    const port = readFromPwa("app/features/relays/hooks/relay-standalone-publish-port.ts");
    expect(port).toContain("publishTransportKernelToRelay");
    expect(port).toContain("publishTransportKernelToRelayUrls");
  });
});

