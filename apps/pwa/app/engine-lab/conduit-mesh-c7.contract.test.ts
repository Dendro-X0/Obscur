import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "../../../../");

describe("conduit-mesh-c7 — client integration wiring", () => {
  it("charter exists and defines C7 scope", () => {
    const charter = readFileSync(
      join(REPO_ROOT, "docs/program/conduit-mesh-c7-client-integration-charter.md"),
      "utf8",
    );
    expect(charter).toMatch(/C7 — client integration/);
    expect(charter).toMatch(/passthrough publish/);
  });

  it("mesh pool hook wires subscribe through nostr ws client", () => {
    const meshHook = readFileSync(
      join(REPO_ROOT, "apps/pwa/app/features/relays/hooks/use-conduit-mesh-relay-pool.ts"),
      "utf8",
    );
    expect(meshHook).toMatch(/createConduitMeshNostrWsClient/);
    expect(meshHook).toMatch(/subscribeToMessages/);
    expect(meshHook).not.toMatch(/conduit-mesh-unwired/);
    expect(meshHook).not.toMatch(/enhanced-relay-pool-legacy/);
  });

  it("relay pool runtime resolves ws urls to nostr_ws descriptors", () => {
    const resolver = readFileSync(
      join(REPO_ROOT, "packages/obscur-conduit-mesh/src/resolve-relay-pool-conduit-descriptors.ts"),
      "utf8",
    );
    expect(resolver).toMatch(/nostr_ws/);
  });

  it("relay pool runtime passthrough-checks nostr event payloads", () => {
    const runtime = readFileSync(
      join(REPO_ROOT, "packages/obscur-conduit-mesh/src/conduit-mesh-relay-pool-runtime.ts"),
      "utf8",
    );
    expect(runtime).toMatch(/isNostrEventWirePayload/);
  });
});
