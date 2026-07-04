import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "../../../../");

const readFromRepo = (relFromRepoRoot: string): string => (
  readFileSync(join(REPO_ROOT, relFromRepoRoot), "utf8")
);

const SMOKE_CHECKLIST_ITEMS = [
  "verify:transport-engine-w52",
  "engine_invoke_transport_publish_relay_event",
  "transport_kernel_host_publish_shim",
  "transport-kernel-standalone-publish-legacy",
  "mapLegacyPublishResultToRelayPublishResult",
] as const;

describe("transport-engine w53 — smoke checklist harness matrix", () => {
  it("pins all manual checklist evidence anchors in charter", () => {
    const charter = readFromRepo(
      "docs/program/transport-engine-w53-live-desktop-publish-smoke-charter.md",
    );
    for (const item of SMOKE_CHECKLIST_ITEMS) {
      expect(charter).toContain(item);
    }
  });

  it("links smoke prerequisites to W48 maintainer gate", () => {
    const charter = readFromRepo(
      "docs/program/transport-engine-w53-live-desktop-publish-smoke-charter.md",
    );
    const review = readFromRepo(
      "docs/program/transport-engine-w48-pre-authority-flip-exit-evidence-review.md",
    );
    expect(charter).toContain("standalone deletion");
    expect(review).toContain("Maintainer gate");
  });
});
