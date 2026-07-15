import { describe, expect, it } from "vitest";

import type { ConduitDescriptor } from "@obscur/conduit-mesh-contracts";

import { createCustomHttpConduitDriver } from "./custom-http-conduit-driver";
import { longPollHttpMeshEnvelopes } from "./custom-http-pull";
import {
  createMeshHttpGatewayFetch,
  createMeshHttpGatewayStore,
  handleMeshHttpGatewayRequest,
  handleMeshHttpGatewayStreamRequest,
} from "./mesh-http-gateway-handler";

const baseUrl = "http://127.0.0.1:8788";
const recipientHex = "bb".repeat(32);

const teamDescriptor = (): ConduitDescriptor => ({
  conduitId: "c12-team",
  dialect: "team_relay",
  endpoints: [baseUrl],
  capabilities: ["publish", "subscribe", "pull"],
  networkPolicy: "clearnet",
  trustTier: "user_configured",
  enabled: true,
  priority: 1,
});

const publishDm = (
  store: ReturnType<typeof createMeshHttpGatewayStore>,
  envelopeId: string,
): void => {
  handleMeshHttpGatewayRequest(
    {
      method: "POST",
      pathname: "/mesh/v1/envelopes",
      bodyText: JSON.stringify({
        contractVersion: "custom_conduit_http_v1",
        envelopeId,
        messageScope: "dm",
        audience: { kind: "dm", recipientPublicKeyHex: recipientHex },
        ciphertextBase64: "YQ==",
        createdAtUnixMs: 1_700_004_100,
      }),
    },
    store,
  );
};

describe("conduit-mesh C12 HTTP long-poll stream", () => {
  it("longPollHttpMeshEnvelopes hits /mesh/v1/stream and returns items", async () => {
    const store = createMeshHttpGatewayStore();
    publishDm(store, "c12-pull-item");

    const page = await longPollHttpMeshEnvelopes({
      baseUrl,
      fetch: createMeshHttpGatewayFetch(store, baseUrl),
      recipientPublicKeyHex: recipientHex,
      timeoutMs: 100,
    });
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.envelopeId).toBe("c12-pull-item");
    expect(page.cursor).toBe("1");
  });

  it("stream request waits for append then returns", async () => {
    const store = createMeshHttpGatewayStore();
    const pending = handleMeshHttpGatewayStreamRequest(
      {
        method: "GET",
        pathname: "/mesh/v1/stream",
        searchParams: new URLSearchParams(`timeoutMs=2000&recipientPublicKeyHex=${recipientHex}`),
      },
      store,
    );

    queueMicrotask(() => {
      publishDm(store, "c12-wake");
    });

    const response = await pending;
    expect(response.status).toBe(200);
    expect(JSON.parse(response.body).items[0]?.envelopeId).toBe("c12-wake");
  });

  it("driver long-poll subscribe delivers inbound and unsubscribes without hang", async () => {
    const store = createMeshHttpGatewayStore();
    publishDm(store, "c12-driver-env");

    const inbound: string[] = [];
    const driver = createCustomHttpConduitDriver({
      descriptor: teamDescriptor(),
      fetch: createMeshHttpGatewayFetch(store, baseUrl),
      streamTimeoutMs: 500,
      onInbound: (envelope) => {
        inbound.push(envelope.envelopeId);
      },
      now: () => Date.now(),
    });

    const unsub = driver.subscribe([{
      scope: { profileId: "c12-driver" },
      messageScope: "dm",
      audience: { kind: "dm", recipientPublicKeyHex: recipientHex },
    }]);

    try {
      const deadline = Date.now() + 2_000;
      while (!inbound.includes("c12-driver-env") && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      expect(inbound).toContain("c12-driver-env");
    } finally {
      unsub();
    }
  });

  it("driver falls back to timer pull when health omits long_poll", async () => {
    const store = createMeshHttpGatewayStore();
    publishDm(store, "c12-fallback-env");

    const baseFetch = createMeshHttpGatewayFetch(store, baseUrl);
    const fetchNoCapability: typeof fetch = async (input, init) => {
      const url = new URL(String(input), baseUrl);
      if (url.pathname.replace(/\/$/, "") === "/mesh/v1/health") {
        return Response.json({
          ok: true,
          contractVersion: "custom_conduit_http_v1",
        });
      }
      return baseFetch(input, init);
    };

    const inbound: string[] = [];
    const driver = createCustomHttpConduitDriver({
      descriptor: teamDescriptor(),
      fetch: fetchNoCapability,
      pullIntervalMs: 40,
      onInbound: (envelope) => {
        inbound.push(envelope.envelopeId);
      },
      now: () => Date.now(),
    });

    const unsub = driver.subscribe([{
      scope: { profileId: "c12-fallback" },
      messageScope: "dm",
      audience: { kind: "dm", recipientPublicKeyHex: recipientHex },
    }]);

    try {
      const deadline = Date.now() + 2_000;
      while (!inbound.includes("c12-fallback-env") && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      expect(inbound).toContain("c12-fallback-env");
    } finally {
      unsub();
    }
  });
});
