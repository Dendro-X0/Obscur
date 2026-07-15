import { describe, expect, it } from "vitest";

import {
  createMeshHttpGatewayStore,
  handleMeshHttpGatewayRequest,
} from "./mesh-http-gateway-handler";
import { createConduitMeshRelayPoolRuntime } from "./conduit-mesh-relay-pool-runtime";
import { createInMemoryConduitFetchRouter } from "./in-memory-conduit-fetch-router";

describe("mesh-http-gateway-handler", () => {
  it("serves health, publish, and pull on mesh v1 paths", () => {
    const store = createMeshHttpGatewayStore();

    const health = handleMeshHttpGatewayRequest(
      { method: "GET", pathname: "/mesh/v1/health" },
      store,
    );
    expect(health.status).toBe(200);
    expect(JSON.parse(health.body).contractVersion).toBe("custom_conduit_http_v1");
    expect(JSON.parse(health.body).capabilities).toEqual(["pull", "long_poll", "sse"]);

    const publish = handleMeshHttpGatewayRequest(
      {
        method: "POST",
        pathname: "/mesh/v1/envelopes",
        bodyText: JSON.stringify({
          contractVersion: "custom_conduit_http_v1",
          envelopeId: "env-1",
          messageScope: "dm",
          audience: { kind: "dm", recipientPublicKeyHex: "aa" },
          ciphertextBase64: "YQ==",
          createdAtUnixMs: 1_700_000_000,
        }),
      },
      store,
    );
    expect(publish.status).toBe(200);
    expect(JSON.parse(publish.body).accepted).toBe(true);

    const pull = handleMeshHttpGatewayRequest(
      { method: "GET", pathname: "/mesh/v1/envelopes" },
      store,
    );
    expect(pull.status).toBe(200);
    expect(JSON.parse(pull.body).items).toHaveLength(1);
  });

  it("filters pull by recipientPublicKeyHex so broadcast presence cannot drown DMs", () => {
    const store = createMeshHttpGatewayStore();
    const publish = (envelopeId: string, recipientPublicKeyHex: string) => {
      handleMeshHttpGatewayRequest(
        {
          method: "POST",
          pathname: "/mesh/v1/envelopes",
          bodyText: JSON.stringify({
            contractVersion: "custom_conduit_http_v1",
            envelopeId,
            messageScope: "dm",
            audience: { kind: "dm", recipientPublicKeyHex },
            ciphertextBase64: "YQ==",
            createdAtUnixMs: 1_700_000_000,
          }),
        },
        store,
      );
    };

    for (let i = 0; i < 20; i += 1) {
      publish(`broadcast-${i}`, "mesh-pool-broadcast");
    }
    publish("dm-1", "bb".repeat(32));

    const unfiltered = handleMeshHttpGatewayRequest(
      { method: "GET", pathname: "/mesh/v1/envelopes", searchParams: new URLSearchParams("limit=50") },
      store,
    );
    expect(JSON.parse(unfiltered.body).items[0]?.envelopeId).toBe("broadcast-0");

    const filtered = handleMeshHttpGatewayRequest(
      {
        method: "GET",
        pathname: "/mesh/v1/envelopes",
        searchParams: new URLSearchParams(`limit=50&recipientPublicKeyHex=${"bb".repeat(32)}`),
      },
      store,
    );
    const body = JSON.parse(filtered.body);
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.envelopeId).toBe("dm-1");
  });

  it("waitForList resolves when append arrives before timeout", async () => {
    const store = createMeshHttpGatewayStore();
    const waitPromise = store.waitForList({
      timeoutMs: 5_000,
      recipientPublicKeyHex: "bb".repeat(32),
    });

    handleMeshHttpGatewayRequest(
      {
        method: "POST",
        pathname: "/mesh/v1/envelopes",
        bodyText: JSON.stringify({
          contractVersion: "custom_conduit_http_v1",
          envelopeId: "stream-wake",
          messageScope: "dm",
          audience: { kind: "dm", recipientPublicKeyHex: "bb".repeat(32) },
          ciphertextBase64: "YQ==",
          createdAtUnixMs: 1_700_000_000,
        }),
      },
      store,
    );

    const page = await waitPromise;
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.envelopeId).toBe("stream-wake");
  });

  it("integrates with mesh relay pool publish via fetch router", async () => {
    const store = createMeshHttpGatewayStore();
    const baseUrl = "http://127.0.0.1:8788";

    const fetchImpl: typeof fetch = async (input, init) => {
      const url = new URL(String(input), baseUrl);
      const response = handleMeshHttpGatewayRequest(
        {
          method: (init?.method ?? "GET").toUpperCase(),
          pathname: url.pathname,
          searchParams: url.searchParams,
          bodyText: typeof init?.body === "string" ? init.body : undefined,
        },
        store,
      );
      return new Response(response.body, {
        status: response.status,
        headers: response.contentType
          ? { "content-type": response.contentType }
          : undefined,
      });
    };

    const runtime = createConduitMeshRelayPoolRuntime({
      profileId: "c8-http",
      fetch: fetchImpl,
      now: () => 1_700_000_900_000,
    });

    await runtime.configureUrls([baseUrl]);
    const result = await runtime.publishToUrls([baseUrl], "opaque-team-payload", {
      quorumRequired: 1,
    });

    expect(result.metQuorum).toBe(true);
    expect(store.size()).toBe(1);
  });

  it("still works with in-memory team relay router (C4 compat)", async () => {
    const fetch = createInMemoryConduitFetchRouter({
      coordinationBaseUrl: "http://127.0.0.1:8787",
      teamRelayBaseUrl: "http://127.0.0.1:8788",
    });
    const runtime = createConduitMeshRelayPoolRuntime({
      profileId: "c8-compat",
      fetch,
      now: () => 1_700_001_000_000,
    });
    await runtime.configureUrls(["http://127.0.0.1:8788"]);
    const result = await runtime.publishToUrls(["http://127.0.0.1:8788"], "payload");
    expect(result.metQuorum).toBe(true);
  });
});
