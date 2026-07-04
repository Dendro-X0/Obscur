import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { shouldUseHostTransportPublishShim } from "@/app/features/transport-kernel/transport-kernel-publish-port";

const REPO_ROOT = join(__dirname, "../../../../");
const PWA_ROOT = join(REPO_ROOT, "apps/pwa");

const readFromRepo = (relFromRepoRoot: string): string => (
  readFileSync(join(REPO_ROOT, relFromRepoRoot), "utf8")
);

const readFromPwa = (relFromPwa: string): string => (
  readFileSync(join(PWA_ROOT, relFromPwa), "utf8")
);

const W41_EXIT_EVIDENCE_WAVES = [
  { item: "Parity harness green", waves: ["w24", "w29", "w39"], verify: "verify:transport-engine-w39" },
  { item: "Network publish wired", waves: ["w40", "w46"], verify: "verify:transport-engine-w46" },
  { item: "Network parity proven", waves: ["w47"], verify: "verify:transport-engine-w47" },
  { item: "Shim gate policy", waves: ["w33", "w38"], verify: "verify:transport-engine-w38" },
  { item: "Single mapper", waves: ["w19", "w20", "w32"], verify: "verify:transport-engine-w32" },
  { item: "Subtraction plan", waves: ["w30", "w48"], verify: "verify:transport-engine-w48" },
] as const;

describe("transport-engine w48 — pre-authority-flip exit evidence review", () => {
  it("pins exit evidence review charter with maintainer gate", () => {
    const charter = readFromRepo(
      "docs/program/transport-engine-w48-pre-authority-flip-exit-evidence-review.md",
    );
    expect(charter).toContain("Pre-Authority-Flip Exit Evidence Review");
    expect(charter).toContain("Maintainer gate");
    expect(charter).toContain("verify:transport-engine-w47");
    expect(charter).toContain("Phase D remains PAUSED");
    expect(charter).toContain("transport-kernel-standalone-publish.ts");
  });

  it("references W41 checklist and W47 network parity harness", () => {
    const charter = readFromRepo(
      "docs/program/transport-engine-w48-pre-authority-flip-exit-evidence-review.md",
    );
    expect(charter).toContain("W41 exit checklist");
    expect(charter).toContain("W47 network publish parity harness");

    const harness = readFromPwa("app/engine-lab/transport-engine-network-publish-parity.ts");
    expect(harness).toContain("assertNetworkPublishParity");
  });

  it("maps W41 exit items to verify gates in package.json", () => {
    const packageJson = readFromRepo("package.json");
    for (const entry of W41_EXIT_EVIDENCE_WAVES) {
      expect(packageJson).toContain(`"${entry.verify}"`);
      for (const wave of entry.waves) {
        expect(
          packageJson.includes(`transport-engine-${wave}`),
          `expected transport-engine-${wave} reference for ${entry.item}`,
        ).toBe(true);
      }
    }
  });

  it("keeps default port routing on standalone kernel owner with shim gate off", () => {
    const port = readFromPwa("app/features/relays/hooks/relay-standalone-publish-port.ts");
    expect(port).toContain("publishTransportKernelToRelayUrls");
    expect(port).toContain("shouldRouteHostTransportPublish");
    expect(shouldUseHostTransportPublishShim()).toBe(false);
  });
});
