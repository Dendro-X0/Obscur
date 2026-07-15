import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "../../../../");

describe("conduit-mesh-c14 — SSE stream", () => {
  it("charter documents C14 SSE scope", () => {
    const charter = readFileSync(
      join(REPO_ROOT, "docs/program/conduit-mesh-c14-sse-stream-charter.md"),
      "utf8",
    );
    expect(charter).toMatch(/C14 — SSE/);
    expect(charter).toMatch(/text\/event-stream/);
  });

  it("design prefers sse over long_poll", () => {
    const design = readFileSync(
      join(REPO_ROOT, "specs/backend/conduit-mesh-c14-sse-stream-design.md"),
      "utf8",
    );
    expect(design).toMatch(/sse → long_poll → pull/);
  });

  it("driver prefer sse when health advertises capability", () => {
    const driver = readFileSync(
      join(REPO_ROOT, "packages/obscur-conduit-mesh/src/custom-http-conduit-driver.ts"),
      "utf8",
    );
    expect(driver).toMatch(/healthSupportsSse/);
    expect(driver).toMatch(/openSseHttpMeshEnvelopeSession/);
  });

  it("relay-gateway pipes SSE Accept requests", () => {
    const server = readFileSync(
      join(REPO_ROOT, "apps/relay-gateway/src/mesh-http-server.ts"),
      "utf8",
    );
    expect(server).toMatch(/text\/event-stream/);
    expect(server).toMatch(/Readable\.fromWeb/);
  });
});
