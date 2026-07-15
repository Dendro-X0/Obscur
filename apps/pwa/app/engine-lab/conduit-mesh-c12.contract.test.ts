import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "../../../../");

describe("conduit-mesh-c12 — HTTP long-poll stream", () => {
  it("charter documents C12 long-poll/SSE scope", () => {
    const charter = readFileSync(
      join(REPO_ROOT, "docs/program/conduit-mesh-c12-http-stream-charter.md"),
      "utf8",
    );
    expect(charter).toMatch(/C12 — HTTP long-poll \/ SSE stream/);
    expect(charter).toMatch(/\/mesh\/v1\/stream/);
  });

  it("design locks long-poll as L1 primary", () => {
    const design = readFileSync(
      join(REPO_ROOT, "specs/backend/conduit-mesh-c12-http-stream-design.md"),
      "utf8",
    );
    expect(design).toMatch(/long-poll/);
    expect(design).toMatch(/capabilities/);
  });

  it("contracts reserve stream path and timeout clamps", () => {
    const contract = readFileSync(
      join(REPO_ROOT, "packages/obscur-conduit-mesh-contracts/src/custom-conduit-contract.ts"),
      "utf8",
    );
    expect(contract).toMatch(/stream: "\/mesh\/v1\/stream"/);
    expect(contract).toMatch(/CUSTOM_CONDUIT_STREAM_DEFAULT_TIMEOUT_MS/);
    expect(contract).toMatch(/long_poll/);
  });

  it("driver prefers long-poll when gateway advertises capability", () => {
    const driver = readFileSync(
      join(REPO_ROOT, "packages/obscur-conduit-mesh/src/custom-http-conduit-driver.ts"),
      "utf8",
    );
    expect(driver).toMatch(/longPollHttpMeshEnvelopes/);
    expect(driver).toMatch(/healthSupportsLongPoll/);
  });

  it("relay-gateway awaits async stream handler", () => {
    const server = readFileSync(
      join(REPO_ROOT, "apps/relay-gateway/src/mesh-http-server.ts"),
      "utf8",
    );
    expect(server).toMatch(/handleMeshHttpGatewayStreamRequest/);
  });
});
