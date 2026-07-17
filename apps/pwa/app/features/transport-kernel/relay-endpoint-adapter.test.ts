import { describe, expect, it } from "vitest";

import { classifyRelayEndpointAdapter } from "./relay-endpoint-adapter";

describe("classifyRelayEndpointAdapter", () => {
  it("classifies public nostr websocket URLs", () => {
    expect(classifyRelayEndpointAdapter("wss://relay.damus.io")).toBe("nostr_public");
  });

  it("classifies private lan websocket URLs", () => {
    expect(classifyRelayEndpointAdapter("ws://192.168.0.10:7000")).toBe("private_ws");
    expect(classifyRelayEndpointAdapter("ws://localhost:7000")).toBe("private_ws");
  });

  it("classifies http mesh gateways", () => {
    expect(classifyRelayEndpointAdapter("http://127.0.0.1:8788")).toBe("http_mesh");
  });

  it("classifies onion endpoints as tor", () => {
    expect(classifyRelayEndpointAdapter("http://example.onion/mesh")).toBe("tor_mesh");
  });
});
