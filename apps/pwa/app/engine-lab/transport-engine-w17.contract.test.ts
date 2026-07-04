import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "../../../../");

const readFromRepo = (relFromRepoRoot: string): string => (
  readFileSync(join(REPO_ROOT, relFromRepoRoot), "utf8")
);

describe("transport-engine w17 — host publish contract slice", () => {
  it("transport engine method catalog includes non-wired publish contract", () => {
    const methods = readFromRepo("packages/obscur-engine-contracts/src/transport-engine-methods.ts");
    expect(methods).toContain("publishRelayEvent");
    expect(methods).toContain("TransportPublishRelayEventPayload");
    expect(methods).toContain("buildTransportPublishRelayEventRequest");
  });

  it("transport publish request builder preserves host boundary shape", () => {
    const methods = readFromRepo("packages/obscur-engine-contracts/src/transport-engine-methods.ts");
    expect(methods).toContain('engine: "transport"');
    expect(methods).toContain("method: TRANSPORT_ENGINE_METHODS.publishRelayEvent");
    expect(methods).toContain("payload: params.payload");
  });

  it("engine invoke validator requires relayUrls and payload for publishRelayEvent", () => {
    const validator = readFromRepo("packages/obscur-engine-contracts/src/validate-engine-invoke.ts");
    expect(validator).toContain('request.method === "publishRelayEvent"');
    expect(validator).toContain("payload.relayUrls");
    expect(validator).toContain("payload.payload");
  });
});

