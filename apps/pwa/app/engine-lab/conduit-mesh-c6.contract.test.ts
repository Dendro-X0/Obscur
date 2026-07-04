import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "../../../../");
const PACKAGE_ROOT = join(REPO_ROOT, "packages/obscur-conduit-mesh");
const CONTRACTS_ROOT = join(REPO_ROOT, "packages/obscur-conduit-mesh-contracts");

describe("conduit-mesh-c6 — nostr_ws driver wiring", () => {
  it("exports nostr_ws driver factory and wire port", () => {
    const indexSource = readFileSync(join(PACKAGE_ROOT, "src/index.ts"), "utf8");
    expect(indexSource).toMatch(/createNostrWsConduitDriver/);
    expect(indexSource).toMatch(/createInMemoryNostrWsWire/);
  });

  it("driver factory handles nostr_ws dialect", () => {
    const source = readFileSync(join(PACKAGE_ROOT, "src/create-conduit-driver.ts"), "utf8");
    expect(source).toMatch(/case "nostr_ws"/);
    expect(source).toMatch(/createNostrWsConduitDriver/);
  });

  it("wire contract pins nostr_ws mesh envelope kind", () => {
    const source = readFileSync(
      join(CONTRACTS_ROOT, "src/nostr-ws-wire-contract.ts"),
      "utf8",
    );
    expect(source).toMatch(/NOSTR_WS_CONDUIT_WIRE_V1/);
    expect(source).toMatch(/OBSCUR_MESH_NOSTR_EVENT_KIND/);
    expect(source).toMatch(/buildNostrWsWirePayload/);
  });

  it("nostr_ws driver does not import enhanced-relay-pool-legacy", () => {
    const source = readFileSync(
      join(PACKAGE_ROOT, "src/nostr-ws-conduit-driver.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/enhanced-relay-pool-legacy/);
    expect(source).not.toMatch(/WebSocket/);
  });
});
