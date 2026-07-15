import { describe, expect, it } from "vitest";

import { isNostrEventWirePayload } from "@obscur/conduit-mesh-contracts";

import { createConduitMeshRelayPoolRuntime } from "./conduit-mesh-relay-pool-runtime";
import { createInMemoryConduitFetchRouter } from "./in-memory-conduit-fetch-router";
import { createInMemoryNostrWsClient } from "./create-in-memory-nostr-ws-client";
import { resolveRelayPoolConduitDescriptors } from "./resolve-relay-pool-conduit-descriptors";

describe("conduit-mesh C7 client integration", () => {
  it("maps ws relay URLs to nostr_ws descriptors", () => {
    const descriptors = resolveRelayPoolConduitDescriptors([
      "wss://relay.example.test",
      "http://127.0.0.1:8788",
    ]);

    expect(descriptors[0]?.dialect).toBe("nostr_ws");
    expect(descriptors[1]?.dialect).toBe("team_relay");
  });

  it("passthrough-publishes pre-built Nostr EVENT payloads without mesh re-wrap", async () => {
    const nostrClient = createInMemoryNostrWsClient({ now: () => 1_700_000_400_000 });
    const runtime = createConduitMeshRelayPoolRuntime({
      profileId: "c7-passthrough",
      nostrWire: nostrClient,
      now: () => 1_700_000_400_000,
    });

    await runtime.configureUrls(["wss://relay.example.test"]);

    const wirePayload = JSON.stringify([
      "EVENT",
      {
        id: "abc123",
        kind: 4,
        pubkey: "aa".repeat(32),
        created_at: 1_700_000_400,
        tags: [["p", "bb".repeat(32)]],
        content: "encrypted",
        sig: "sig",
      },
    ]);

    expect(isNostrEventWirePayload(wirePayload)).toBe(true);

    const result = await runtime.publishToUrls(["wss://relay.example.test"], wirePayload);
    expect(result.metQuorum).toBe(true);
    expect(result.results[0]?.success).toBe(true);
  });

  it("delivers subscribed events through the in-memory nostr client", async () => {
    const nostrClient = createInMemoryNostrWsClient({ now: () => 1_700_000_500_000 });
    const runtime = createConduitMeshRelayPoolRuntime({
      profileId: "c7-subscribe",
      nostrWire: nostrClient,
      now: () => 1_700_000_500_000,
    });

    await runtime.configureUrls(["wss://relay.example.test"]);

    const received: Array<{ id?: string; relayUrl: string }> = [];
    const subId = nostrClient.subscribe(
      [{ kinds: [4], "#p": ["bb".repeat(32)] }],
      (event, relayUrl) => {
        received.push({ id: typeof event.id === "string" ? event.id : undefined, relayUrl });
      },
    );

    expect(subId).toMatch(/^inmem-sub-/);

    const wirePayload = JSON.stringify([
      "EVENT",
      {
        id: "incoming-1",
        kind: 4,
        pubkey: "aa".repeat(32),
        created_at: 1_700_000_500,
        tags: [["p", "bb".repeat(32)]],
        content: "encrypted",
        sig: "sig",
      },
    ]);

    await runtime.publishToUrls(["wss://relay.example.test"], wirePayload);
    expect(received).toEqual([{ id: "incoming-1", relayUrl: "wss://relay.example.test" }]);

    nostrClient.unsubscribe(subId);
  });

  it("still publishes HTTP relay URLs via mesh envelope orchestration", async () => {
    const fetch = createInMemoryConduitFetchRouter({
      coordinationBaseUrl: "http://127.0.0.1:8787",
      teamRelayBaseUrl: "http://127.0.0.1:8788",
    });

    const runtime = createConduitMeshRelayPoolRuntime({
      profileId: "c7-http",
      fetch,
      now: () => 1_700_000_600_000,
    });

    await runtime.configureUrls(["http://127.0.0.1:8788"]);

    const result = await runtime.publishToUrls(
      ["http://127.0.0.1:8788"],
      "opaque-mesh-payload",
      { quorumRequired: 1 },
    );

    expect(result.metQuorum).toBe(true);
  });
});
