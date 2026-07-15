import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { encodeCiphertextBase64 } from "./conduit-http-utils";
import { createConduitMeshRelayPoolRuntime } from "./conduit-mesh-relay-pool-runtime";
import { createInMemoryNostrWsClient } from "./create-in-memory-nostr-ws-client";
import {
  createMeshHttpGatewayFetch,
  createMeshHttpGatewayStore,
  handleMeshHttpGatewayRequest,
} from "./mesh-http-gateway-handler";

const baseUrl = "http://127.0.0.1:8788";
const recipientHex = "bb".repeat(32);

const buildGatewayFetch = (store: ReturnType<typeof createMeshHttpGatewayStore>): typeof fetch => (
  createMeshHttpGatewayFetch(store, baseUrl)
);

const buildNostrWirePayload = (): string => JSON.stringify([
  "EVENT",
  {
    id: "c10-inbound",
    kind: 4,
    pubkey: "aa".repeat(32),
    created_at: 1_700_002_100,
    tags: [["p", recipientHex]],
    content: "encrypted",
    sig: "sig",
  },
]);

describe("conduit-mesh C10 HTTP pull/subscribe", () => {
  const runtimes: Array<ReturnType<typeof createConduitMeshRelayPoolRuntime>> = [];

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    while (runtimes.length > 0) {
      runtimes.pop()?.dispose();
    }
    vi.useRealTimers();
  });

  it("pulls Nostr wire envelopes from HTTP gateway and bridges to subscribeToMessages", async () => {
    const store = createMeshHttpGatewayStore();
    const wirePayload = buildNostrWirePayload();

    handleMeshHttpGatewayRequest(
      {
        method: "POST",
        pathname: "/mesh/v1/envelopes",
        bodyText: JSON.stringify({
          contractVersion: "custom_conduit_http_v1",
          envelopeId: "c10-env-1",
          messageScope: "dm",
          audience: { kind: "dm", recipientPublicKeyHex: recipientHex },
          ciphertextBase64: encodeCiphertextBase64(new TextEncoder().encode(wirePayload)),
          createdAtUnixMs: 1_700_002_100,
        }),
      },
      store,
    );

    const nostrClient = createInMemoryNostrWsClient({ now: () => 1_700_002_100_000 });
    const runtime = createConduitMeshRelayPoolRuntime({
      profileId: "c10-pull",
      fetch: buildGatewayFetch(store),
      httpPullIntervalMs: 100,
      bridgeInboundWire: (relayUrl, message) => {
        nostrClient.deliverInboundMessage(relayUrl, message);
      },
      now: () => 1_700_002_100_000,
    });
    runtimes.push(runtime);

    await runtime.configureUrls([baseUrl]);

    const received: Array<{ url: string; message: string }> = [];
    nostrClient.subscribeToMessages(({ url, message }) => {
      received.push({ url, message });
    });

    runtime.registerInboundInterests([{
      scope: { profileId: "c10-pull" },
      messageScope: "dm",
      audience: { kind: "dm", recipientPublicKeyHex: recipientHex },
    }]);

    await vi.advanceTimersByTimeAsync(150);

    expect(received).toEqual([{ url: baseUrl, message: wirePayload }]);
  });

  it("re-arms HTTP pull after configureUrls so inbound survives conduit remount", async () => {
    const store = createMeshHttpGatewayStore();
    const wirePayload = buildNostrWirePayload();
    const nostrClient = createInMemoryNostrWsClient({ now: () => 1_700_002_150_000 });
    const runtime = createConduitMeshRelayPoolRuntime({
      profileId: "c10-rearm",
      fetch: buildGatewayFetch(store),
      httpPullIntervalMs: 100,
      bridgeInboundWire: (relayUrl, message) => {
        nostrClient.deliverInboundMessage(relayUrl, message);
      },
      now: () => 1_700_002_150_000,
    });
    runtimes.push(runtime);

    await runtime.configureUrls([baseUrl]);
    const received: string[] = [];
    nostrClient.subscribeToMessages(({ message }) => {
      received.push(message);
    });
    runtime.registerInboundInterests([{
      scope: { profileId: "c10-rearm" },
      messageScope: "dm",
      audience: { kind: "dm", recipientPublicKeyHex: recipientHex },
    }]);

    // Remount conduits (same URL) — previously stopped pull forever.
    await runtime.configureUrls([baseUrl]);

    handleMeshHttpGatewayRequest(
      {
        method: "POST",
        pathname: "/mesh/v1/envelopes",
        bodyText: JSON.stringify({
          contractVersion: "custom_conduit_http_v1",
          envelopeId: "c10-env-rearm",
          messageScope: "dm",
          audience: { kind: "dm", recipientPublicKeyHex: recipientHex },
          ciphertextBase64: encodeCiphertextBase64(new TextEncoder().encode(wirePayload)),
          createdAtUnixMs: 1_700_002_150,
        }),
      },
      store,
    );

    await vi.advanceTimersByTimeAsync(150);
    expect(received).toContain(wirePayload);
  });

  it("records inbound evidence on mesh subscribeInbound", async () => {
    const store = createMeshHttpGatewayStore();
    const wirePayload = buildNostrWirePayload();

    handleMeshHttpGatewayRequest(
      {
        method: "POST",
        pathname: "/mesh/v1/envelopes",
        bodyText: JSON.stringify({
          contractVersion: "custom_conduit_http_v1",
          envelopeId: "c10-env-evidence",
          messageScope: "dm",
          audience: { kind: "dm", recipientPublicKeyHex: recipientHex },
          ciphertextBase64: encodeCiphertextBase64(new TextEncoder().encode(wirePayload)),
          createdAtUnixMs: 1_700_002_200,
        }),
      },
      store,
    );

    const runtime = createConduitMeshRelayPoolRuntime({
      profileId: "c10-evidence",
      fetch: buildGatewayFetch(store),
      httpPullIntervalMs: 100,
      now: () => 1_700_002_200_000,
    });
    runtimes.push(runtime);

    await runtime.configureUrls([baseUrl]);

    const inbound: string[] = [];
    runtime.mesh.subscribeInbound(({ envelope }) => {
      inbound.push(envelope.envelopeId);
    });

    runtime.registerInboundInterests([{
      scope: { profileId: "c10-evidence" },
      messageScope: "dm",
      audience: { kind: "dm", recipientPublicKeyHex: recipientHex },
    }]);

    await vi.advanceTimersByTimeAsync(150);

    expect(inbound).toContain("c10-env-evidence");
    expect(runtime.mesh.evidenceLedger.listForEnvelope("c10-env-evidence").some(
      (record) => record.kind === "inbound_at_recipient",
    )).toBe(true);
  });

  it("publishes Nostr EVENT wire to HTTP team_relay via mesh envelope (not WS passthrough)", async () => {
    const store = createMeshHttpGatewayStore();
    const runtime = createConduitMeshRelayPoolRuntime({
      profileId: "c10-publish",
      fetch: buildGatewayFetch(store),
      // nostrWire intentionally omitted — HTTP path must not require WS.
      now: () => 1_700_002_300_000,
    });
    runtimes.push(runtime);

    await runtime.configureUrls([baseUrl]);

    const wirePayload = buildNostrWirePayload();
    const result = await runtime.publishToUrls([baseUrl], wirePayload, { quorumRequired: 1 });

    expect(result.metQuorum).toBe(true);
    expect(result.results[0]?.success).toBe(true);

    const listed = handleMeshHttpGatewayRequest(
      { method: "GET", pathname: "/mesh/v1/envelopes", searchParams: new URLSearchParams() },
      store,
    );
    expect(listed.status).toBe(200);
    const body = JSON.parse(listed.body ?? "{}") as { items?: unknown[] };
    expect(Array.isArray(body.items) ? body.items.length : 0).toBeGreaterThan(0);
    const first = (body.items as Array<{ audience?: { recipientPublicKeyHex?: string } }>)[0];
    expect(first?.audience?.recipientPublicKeyHex).toBe(recipientHex);
  });
});
