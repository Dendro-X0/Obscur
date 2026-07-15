import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "../../../../");

describe("conduit-mesh-c10 — HTTP pull/subscribe", () => {
  it("charter documents C10 scope", () => {
    const charter = readFileSync(
      join(REPO_ROOT, "docs/program/conduit-mesh-c10-http-pull-subscribe-charter.md"),
      "utf8",
    );
    expect(charter).toMatch(/C10 — team_relay HTTP pull\/subscribe/);
    expect(charter).toMatch(/GET \/mesh\/v1\/envelopes/);
  });

  it("mesh registers inbound interests and wires HTTP driver onInbound", () => {
    const mesh = readFileSync(
      join(REPO_ROOT, "packages/obscur-conduit-mesh/src/create-conduit-mesh.ts"),
      "utf8",
    );
    expect(mesh).toMatch(/registerInboundInterests/);
    expect(mesh).toMatch(/deliverInbound/);
  });

  it("relay pool runtime bridges HTTP inbound Nostr wire to client", () => {
    const runtime = readFileSync(
      join(REPO_ROOT, "packages/obscur-conduit-mesh/src/conduit-mesh-relay-pool-runtime.ts"),
      "utf8",
    );
    expect(runtime).toMatch(/bridgeInboundWire/);
    expect(runtime).toMatch(/registerInboundInterests/);
    expect(runtime).toMatch(/isNostrEventWirePayload/);
  });

  it("useConduitMeshRelayPool wires bridgeInboundWire and mesh interests on subscribe", () => {
    const hook = readFileSync(
      join(REPO_ROOT, "apps/pwa/app/features/relays/hooks/use-conduit-mesh-relay-pool.ts"),
      "utf8",
    );
    expect(hook).toMatch(/bridgeInboundWire/);
    expect(hook).toMatch(/deliverInboundMessage/);
    expect(hook).toMatch(/registerInboundInterests/);
    expect(hook).toMatch(/filtersToMeshInterests/);
  });
});
