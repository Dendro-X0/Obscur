import { describe, expect, it, vi } from "vitest";

import { createConduitMeshSocksFetchHostPort } from "./conduit-mesh-socks-fetch-port";

describe("conduit-mesh-socks-fetch-port", () => {
  it("invokes mesh_http_fetch_via_socks with proxyUrl and maps Response", async () => {
    const invoke = vi.fn(async () => ({
      ok: true as const,
      value: {
        status: 200,
        bodyText: "{\"ok\":true}",
        contentType: "application/json",
      },
    }));

    const port = createConduitMeshSocksFetchHostPort(invoke as never);
    const response = await port.socksFetch(
      "socks5h://127.0.0.1:9050",
      "http://example.onion/mesh/v1/health",
      { method: "GET" },
    );

    expect(invoke).toHaveBeenCalledWith("mesh_http_fetch_via_socks", {
      url: "http://example.onion/mesh/v1/health",
      method: "GET",
      proxyUrl: "socks5h://127.0.0.1:9050",
      headers: undefined,
      bodyText: undefined,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("x-obscur-fetch-route")).toBe("socks");
    expect(await response.text()).toBe("{\"ok\":true}");
  });

  it("returns socks_unavailable when native invoke fails", async () => {
    const invoke = vi.fn(async () => ({
      ok: false as const,
      message: "not native",
    }));
    const port = createConduitMeshSocksFetchHostPort(invoke as never);
    const response = await port.socksFetch(
      "socks5h://127.0.0.1:9050",
      "http://example.onion/mesh/v1/health",
    );
    expect(response.status).toBe(503);
    expect(response.headers.get("x-obscur-fetch-route")).toBe("socks_unavailable");
  });
});
