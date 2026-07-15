import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "../../../../");

describe("conduit-mesh-c7c — settings conduits UX", () => {
  it("charter documents C7c scope", () => {
    const charter = readFileSync(
      join(REPO_ROOT, "docs/program/conduit-mesh-c7-client-integration-charter.md"),
      "utf8",
    );
    expect(charter).toMatch(/C7c/);
  });

  it("L3 soak runbook exists", () => {
    const runbook = readFileSync(
      join(REPO_ROOT, "docs/program/conduit-mesh-c7-l3-soak-runbook.md"),
      "utf8",
    );
    expect(runbook).toMatch(/Row B — Dual-window DM/);
  });

  it("relays settings panel mounts conduit mesh settings panel", () => {
    const panel = readFileSync(
      join(REPO_ROOT, "apps/pwa/app/settings/panels/relays-settings-tab-panel.tsx"),
      "utf8",
    );
    expect(panel).toMatch(/ConduitMeshSettingsPanel/);
  });

  it("settings snapshot service resolves pool owner and dialects", () => {
    const snapshot = readFileSync(
      join(REPO_ROOT, "apps/pwa/app/features/transport-kernel/conduit-mesh-settings-snapshot.ts"),
      "utf8",
    );
    expect(snapshot).toMatch(/resolveConduitMeshPoolOwner/);
    expect(snapshot).toMatch(/resolveRelayPoolConduitDescriptors/);
  });
});
