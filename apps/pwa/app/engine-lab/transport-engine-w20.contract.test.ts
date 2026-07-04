import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "../../../../");

const readFromRepo = (relFromRepoRoot: string): string => (
  readFileSync(join(REPO_ROOT, relFromRepoRoot), "utf8")
);

describe("transport-engine w20 — publishRelayEvent result/evidence contract", () => {
  it("defines a typed publish result contract in engine-contracts", () => {
    const methods = readFromRepo("packages/obscur-engine-contracts/src/transport-engine-methods.ts");
    expect(methods).toContain("TransportPublishRelayEventResult");
    expect(methods).toContain("TransportPublishRelayEventRelayResult");
    expect(methods).toContain("quorumRequired");
    expect(methods).toContain("metQuorum");
    expect(methods).toContain("overallError");
  });

  it("exports the publish result contract from engine-contracts index", () => {
    const index = readFromRepo("packages/obscur-engine-contracts/src/index.ts");
    expect(index).toContain("TransportPublishRelayEventResult");
    expect(index).toContain("TransportPublishRelayEventRelayResult");
    expect(index).toContain("isTransportPublishRelayEventResult");
  });

  it("pins that w20 remains contract-only (no runtime wiring)", () => {
    const rust = readFromRepo("packages/libobscur/src/engine_invoke.rs");
    expect(rust).toContain("transport_publish_not_wired");
  });
});

