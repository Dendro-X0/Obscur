import { describe, expect, it, vi } from "vitest";

import type { ConduitDescriptor } from "@obscur/conduit-mesh-contracts";

import { createRoutedConduitMeshFetch } from "./create-routed-conduit-mesh-fetch";

const descriptor = (
  networkPolicy: ConduitDescriptor["networkPolicy"],
): ConduitDescriptor => ({
  conduitId: "c13-route",
  dialect: "team_relay",
  endpoints: ["http://example.onion:8788"],
  capabilities: ["publish", "subscribe"],
  networkPolicy,
  trustTier: "user_configured",
  enabled: true,
  priority: 0,
});

describe("createRoutedConduitMeshFetch", () => {
  it("routes tor_required through socksFetch with proxyUrl metadata", async () => {
    const socksFetch = vi.fn(async (proxyUrl: string) => (
      new Response(`via:${proxyUrl}`, { status: 200 })
    ));
    const directFetch = vi.fn(async () => new Response("direct", { status: 200 }));

    const fetch = createRoutedConduitMeshFetch({
      descriptor: descriptor("tor_required"),
      getTorState: async () => ({
        configured: true,
        ready: true,
        proxyUrl: "socks5h://127.0.0.1:9050",
      }),
      directFetch,
      socksFetch,
    });

    const response = await fetch("http://example.onion:8788/mesh/v1/health");
    expect(socksFetch).toHaveBeenCalledOnce();
    expect(directFetch).not.toHaveBeenCalled();
    expect(response.headers.get("x-obscur-fetch-route")).toBe("socks");
    expect(response.headers.get("x-obscur-proxy-url")).toBe("socks5h://127.0.0.1:9050");
    expect(await response.text()).toBe("via:socks5h://127.0.0.1:9050");
  });

  it("uses directFetch for clearnet", async () => {
    const socksFetch = vi.fn(async () => new Response("socks", { status: 200 }));
    const directFetch = vi.fn(async () => new Response("direct", { status: 200 }));

    const fetch = createRoutedConduitMeshFetch({
      descriptor: descriptor("clearnet"),
      getTorState: async () => ({
        configured: true,
        ready: true,
        proxyUrl: "socks5h://127.0.0.1:9050",
      }),
      directFetch,
      socksFetch,
    });

    const response = await fetch("http://127.0.0.1:8788/mesh/v1/health");
    expect(directFetch).toHaveBeenCalledOnce();
    expect(socksFetch).not.toHaveBeenCalled();
    expect(response.headers.get("x-obscur-fetch-route")).toBe("direct");
  });

  it("returns 503 without calling socks when tor_required and Tor down", async () => {
    const socksFetch = vi.fn(async () => new Response("socks", { status: 200 }));
    const directFetch = vi.fn(async () => new Response("direct", { status: 200 }));

    const fetch = createRoutedConduitMeshFetch({
      descriptor: descriptor("tor_required"),
      getTorState: async () => ({ configured: true, ready: false }),
      directFetch,
      socksFetch,
    });

    const response = await fetch("http://example.onion:8788/mesh/v1/envelopes");
    expect(response.status).toBe(503);
    expect(response.headers.get("x-obscur-fetch-route")).toBe("blocked");
    expect(socksFetch).not.toHaveBeenCalled();
    expect(directFetch).not.toHaveBeenCalled();
  });
});
