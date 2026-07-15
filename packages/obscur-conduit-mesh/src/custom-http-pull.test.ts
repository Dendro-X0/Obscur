import { describe, expect, it } from "vitest";

import {
  createMeshHttpGatewayStore,
  handleMeshHttpGatewayRequest,
} from "./mesh-http-gateway-handler";
import {
  pullHttpMeshEnvelopes,
  pullItemMatchesInterests,
  pullItemToMeshEnvelope,
} from "./custom-http-pull";

describe("custom-http-pull", () => {
  it("pulls envelopes from mesh gateway handler", async () => {
    const store = createMeshHttpGatewayStore();
    const baseUrl = "http://127.0.0.1:8788";

    handleMeshHttpGatewayRequest(
      {
        method: "POST",
        pathname: "/mesh/v1/envelopes",
        bodyText: JSON.stringify({
          contractVersion: "custom_conduit_http_v1",
          envelopeId: "pull-1",
          messageScope: "dm",
          audience: { kind: "dm", recipientPublicKeyHex: "bb".repeat(32) },
          ciphertextBase64: "YQ==",
          createdAtUnixMs: 1_700_002_000,
        }),
      },
      store,
    );

    const fetchImpl: typeof fetch = async (input, init) => {
      const url = new URL(String(input), baseUrl);
      const response = handleMeshHttpGatewayRequest(
        {
          method: (init?.method ?? "GET").toUpperCase(),
          pathname: url.pathname,
          searchParams: url.searchParams,
        },
        store,
      );
      return new Response(response.body, { status: response.status });
    };

    const pulled = await pullHttpMeshEnvelopes({ baseUrl, fetch: fetchImpl });
    expect(pulled.items).toHaveLength(1);
    expect(pulled.items[0]?.envelopeId).toBe("pull-1");
  });

  it("requests recipientPublicKeyHex so gateway can skip broadcast pages", async () => {
    const store = createMeshHttpGatewayStore();
    const baseUrl = "http://127.0.0.1:8788";
    const recipient = "bb".repeat(32);

    for (let i = 0; i < 5; i += 1) {
      handleMeshHttpGatewayRequest(
        {
          method: "POST",
          pathname: "/mesh/v1/envelopes",
          bodyText: JSON.stringify({
            contractVersion: "custom_conduit_http_v1",
            envelopeId: `broadcast-${i}`,
            messageScope: "dm",
            audience: { kind: "dm", recipientPublicKeyHex: "mesh-pool-broadcast" },
            ciphertextBase64: "YQ==",
            createdAtUnixMs: 1_700_002_000,
          }),
        },
        store,
      );
    }
    handleMeshHttpGatewayRequest(
      {
        method: "POST",
        pathname: "/mesh/v1/envelopes",
        bodyText: JSON.stringify({
          contractVersion: "custom_conduit_http_v1",
          envelopeId: "dm-only",
          messageScope: "dm",
          audience: { kind: "dm", recipientPublicKeyHex: recipient },
          ciphertextBase64: "YQ==",
          createdAtUnixMs: 1_700_002_001,
        }),
      },
      store,
    );

    const fetchImpl: typeof fetch = async (input, init) => {
      const url = new URL(String(input), baseUrl);
      const response = handleMeshHttpGatewayRequest(
        {
          method: (init?.method ?? "GET").toUpperCase(),
          pathname: url.pathname,
          searchParams: url.searchParams,
        },
        store,
      );
      return new Response(response.body, { status: response.status });
    };

    const pulled = await pullHttpMeshEnvelopes({
      baseUrl,
      fetch: fetchImpl,
      recipientPublicKeyHex: recipient,
    });
    expect(pulled.items).toHaveLength(1);
    expect(pulled.items[0]?.envelopeId).toBe("dm-only");
  });

  it("matches dm interests by recipient pubkey", () => {
    const item = {
      envelopeId: "x",
      messageScope: "dm" as const,
      audience: { kind: "dm" as const, recipientPublicKeyHex: "bb".repeat(32) },
      ciphertextBase64: "YQ==",
      createdAtUnixMs: 1,
    };

    expect(pullItemMatchesInterests(item, [{
      scope: { profileId: "p" },
      messageScope: "dm",
      audience: { kind: "dm", recipientPublicKeyHex: "bb".repeat(32) },
    }])).toBe(true);

    expect(pullItemMatchesInterests(item, [{
      scope: { profileId: "p" },
      messageScope: "dm",
      audience: { kind: "dm", recipientPublicKeyHex: "cc".repeat(32) },
    }])).toBe(false);
  });

  it("maps pull items to mesh envelopes", () => {
    const envelope = pullItemToMeshEnvelope({
      envelopeId: "env-1",
      messageScope: "dm",
      audience: { kind: "dm", recipientPublicKeyHex: "aa" },
      ciphertextBase64: "YQ==",
      createdAtUnixMs: 123,
    }, "profile-1");

    expect(envelope.scope.profileId).toBe("profile-1");
    expect(envelope.envelopeId).toBe("env-1");
    expect(envelope.ciphertext[0]).toBe(97);
  });
});
