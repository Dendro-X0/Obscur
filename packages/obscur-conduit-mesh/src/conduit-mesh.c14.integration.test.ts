import { describe, expect, it } from "vitest";

import type { ConduitDescriptor } from "@obscur/conduit-mesh-contracts";

import { createCustomHttpConduitDriver } from "./custom-http-conduit-driver";
import {
  createMeshHttpGatewayFetch,
  createMeshHttpGatewayStore,
  handleMeshHttpGatewayRequest,
} from "./mesh-http-gateway-handler";
import {
  parseMeshHttpSseBuffer,
  wantsMeshHttpSse,
} from "./mesh-http-sse";

const baseUrl = "http://127.0.0.1:8788";
const recipientHex = "bb".repeat(32);

const teamDescriptor = (): ConduitDescriptor => ({
  conduitId: "c14-team",
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
        createdAtUnixMs: 1_700_006_100,
      }),
    },
    store,
  );
};

describe("conduit-mesh C14 SSE stream", () => {
  it("detects Accept: text/event-stream", () => {
    expect(wantsMeshHttpSse({ accept: "text/event-stream" })).toBe(true);
    expect(wantsMeshHttpSse({ accept: "application/json" })).toBe(false);
  });

  it("parses SSE envelope frames", () => {
    const frame = "id: 1\nevent: envelope\ndata: {\"envelopeId\":\"e1\",\"messageScope\":\"dm\",\"audience\":{},\"ciphertextBase64\":\"YQ==\",\"createdAtUnixMs\":1}\n\n";
    const parsed = parseMeshHttpSseBuffer(frame);
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]?.envelopeId).toBe("e1");
    expect(parsed.cursors[0]).toBe("1");
  });

  it("SSE stream emits backlog and live append then unsubscribes", async () => {
    const store = createMeshHttpGatewayStore();
    publishDm(store, "c14-backlog");
    const fetchImpl = createMeshHttpGatewayFetch(store, baseUrl);

    const inbound: string[] = [];
    const driver = createCustomHttpConduitDriver({
      descriptor: teamDescriptor(),
      fetch: fetchImpl,
      streamTimeoutMs: 500,
      onInbound: (envelope) => {
        inbound.push(envelope.envelopeId);
      },
      now: () => Date.now(),
    });

    const unsub = driver.subscribe([{
      scope: { profileId: "c14-sse" },
      messageScope: "dm",
      audience: { kind: "dm", recipientPublicKeyHex: recipientHex },
    }]);

    try {
      const deadline = Date.now() + 2_000;
      while (!inbound.includes("c14-backlog") && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      expect(inbound).toContain("c14-backlog");

      publishDm(store, "c14-live");
      const liveDeadline = Date.now() + 2_000;
      while (!inbound.includes("c14-live") && Date.now() < liveDeadline) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      expect(inbound).toContain("c14-live");
    } finally {
      unsub();
    }
  });

  it("health advertises sse capability", () => {
    const store = createMeshHttpGatewayStore();
    const health = handleMeshHttpGatewayRequest(
      { method: "GET", pathname: "/mesh/v1/health" },
      store,
    );
    expect(JSON.parse(health.body).capabilities).toContain("sse");
  });
});
