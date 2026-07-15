import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  isMeshNativeDmWirePayload,
  isNostrEventWirePayload,
} from "@obscur/conduit-mesh-contracts";

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
    id: "c11-inbound",
    kind: 4,
    pubkey: "aa".repeat(32),
    created_at: 1_700_003_100,
    tags: [["p", recipientHex]],
    content: "encrypted",
    sig: "sig",
  },
]);

const decodeFirstGatewayCiphertext = (
  store: ReturnType<typeof createMeshHttpGatewayStore>,
): string => {
  const listed = handleMeshHttpGatewayRequest(
    { method: "GET", pathname: "/mesh/v1/envelopes", searchParams: new URLSearchParams() },
    store,
  );
  const body = JSON.parse(listed.body ?? "{}") as {
    items?: Array<{ ciphertextBase64?: string }>;
  };
  const ciphertextBase64 = body.items?.[0]?.ciphertextBase64;
  if (!ciphertextBase64) {
    throw new Error("missing_gateway_ciphertext");
  }
  return new TextDecoder().decode(
    Uint8Array.from(atob(ciphertextBase64), (char) => char.charCodeAt(0)),
  );
};

describe("conduit-mesh C11 mesh-native DM wire codec", () => {
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

  it("pulls mesh-native wire from gateway and bridges Nostr EVENT to subscribe path", async () => {
    const store = createMeshHttpGatewayStore();
    const nativeWire = JSON.stringify({
      contractVersion: "obscur_mesh_dm_wire_v1",
      event: JSON.parse(buildNostrWirePayload())[1],
    });
    const expectedNostrWire = buildNostrWirePayload();

    handleMeshHttpGatewayRequest(
      {
        method: "POST",
        pathname: "/mesh/v1/envelopes",
        bodyText: JSON.stringify({
          contractVersion: "custom_conduit_http_v1",
          envelopeId: "c11-env-native",
          messageScope: "dm",
          audience: { kind: "dm", recipientPublicKeyHex: recipientHex },
          ciphertextBase64: encodeCiphertextBase64(new TextEncoder().encode(nativeWire)),
          createdAtUnixMs: 1_700_003_100,
        }),
      },
      store,
    );

    const nostrClient = createInMemoryNostrWsClient({ now: () => 1_700_003_100_000 });
    const runtime = createConduitMeshRelayPoolRuntime({
      profileId: "c11-pull",
      fetch: buildGatewayFetch(store),
      httpPullIntervalMs: 100,
      bridgeInboundWire: (relayUrl, message) => {
        nostrClient.deliverInboundMessage(relayUrl, message);
      },
      now: () => 1_700_003_100_000,
    });
    runtimes.push(runtime);

    await runtime.configureUrls([baseUrl]);

    const received: Array<{ url: string; message: string }> = [];
    nostrClient.subscribeToMessages(({ url, message }) => {
      received.push({ url, message });
    });

    runtime.registerInboundInterests([{
      scope: { profileId: "c11-pull" },
      messageScope: "dm",
      audience: { kind: "dm", recipientPublicKeyHex: recipientHex },
    }]);

    await vi.advanceTimersByTimeAsync(150);

    expect(received).toEqual([{ url: baseUrl, message: expectedNostrWire }]);
  });

  it("still bridges legacy Nostr wire ciphertext stored on gateway (backward compat)", async () => {
    const store = createMeshHttpGatewayStore();
    const wirePayload = buildNostrWirePayload();

    handleMeshHttpGatewayRequest(
      {
        method: "POST",
        pathname: "/mesh/v1/envelopes",
        bodyText: JSON.stringify({
          contractVersion: "custom_conduit_http_v1",
          envelopeId: "c11-env-legacy",
          messageScope: "dm",
          audience: { kind: "dm", recipientPublicKeyHex: recipientHex },
          ciphertextBase64: encodeCiphertextBase64(new TextEncoder().encode(wirePayload)),
          createdAtUnixMs: 1_700_003_150,
        }),
      },
      store,
    );

    const nostrClient = createInMemoryNostrWsClient({ now: () => 1_700_003_150_000 });
    const runtime = createConduitMeshRelayPoolRuntime({
      profileId: "c11-legacy",
      fetch: buildGatewayFetch(store),
      httpPullIntervalMs: 100,
      bridgeInboundWire: (relayUrl, message) => {
        nostrClient.deliverInboundMessage(relayUrl, message);
      },
      now: () => 1_700_003_150_000,
    });
    runtimes.push(runtime);

    await runtime.configureUrls([baseUrl]);
    const received: string[] = [];
    nostrClient.subscribeToMessages(({ message }) => {
      received.push(message);
    });
    runtime.registerInboundInterests([{
      scope: { profileId: "c11-legacy" },
      messageScope: "dm",
      audience: { kind: "dm", recipientPublicKeyHex: recipientHex },
    }]);

    await vi.advanceTimersByTimeAsync(150);
    expect(received).toContain(wirePayload);
  });

  it("publishes Nostr EVENT input to HTTP gateway as mesh-native wire", async () => {
    const store = createMeshHttpGatewayStore();
    const runtime = createConduitMeshRelayPoolRuntime({
      profileId: "c11-publish",
      fetch: buildGatewayFetch(store),
      now: () => 1_700_003_200_000,
    });
    runtimes.push(runtime);

    await runtime.configureUrls([baseUrl]);

    const wirePayload = buildNostrWirePayload();
    const result = await runtime.publishToUrls([baseUrl], wirePayload, { quorumRequired: 1 });

    expect(result.metQuorum).toBe(true);

    const stored = decodeFirstGatewayCiphertext(store);
    expect(isMeshNativeDmWirePayload(stored)).toBe(true);
    expect(isNostrEventWirePayload(stored)).toBe(false);
  });
});
