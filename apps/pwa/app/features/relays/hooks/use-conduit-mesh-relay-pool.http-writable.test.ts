import { describe, expect, it } from "vitest";

import { isHttpMeshPoolUrl } from "./use-conduit-mesh-relay-pool";

describe("isHttpMeshPoolUrl", () => {
  it("accepts loopback mesh HTTP gateways", () => {
    expect(isHttpMeshPoolUrl("http://127.0.0.1:8788")).toBe(true);
    expect(isHttpMeshPoolUrl("https://localhost:8788")).toBe(true);
  });

  it("rejects websocket URLs", () => {
    expect(isHttpMeshPoolUrl("wss://nos.lol")).toBe(false);
    expect(isHttpMeshPoolUrl("ws://localhost:7000")).toBe(false);
  });
});
