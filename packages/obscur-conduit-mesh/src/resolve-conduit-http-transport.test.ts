import { describe, expect, it } from "vitest";

import type { ConduitDescriptor, MeshTorRuntimeState } from "@obscur/conduit-mesh-contracts";

import {
  isOnionMeshEndpoint,
  resolveConduitHttpTransportMode,
} from "./resolve-conduit-http-transport";

const descriptor = (
  networkPolicy: ConduitDescriptor["networkPolicy"],
): ConduitDescriptor => ({
  conduitId: "c13",
  dialect: "team_relay",
  endpoints: ["http://127.0.0.1:8788"],
  capabilities: ["publish", "subscribe"],
  networkPolicy,
  trustTier: "user_configured",
  enabled: true,
  priority: 0,
});

const torReady: MeshTorRuntimeState = {
  configured: true,
  ready: true,
  proxyUrl: "socks5h://127.0.0.1:9050",
};

const torDown: MeshTorRuntimeState = {
  configured: true,
  ready: false,
};

describe("resolveConduitHttpTransportMode", () => {
  it("uses direct for clearnet always", () => {
    expect(resolveConduitHttpTransportMode(descriptor("clearnet"), torReady)).toBe("direct");
    expect(resolveConduitHttpTransportMode(descriptor("clearnet"), torDown)).toBe("direct");
  });

  it("uses socks for tor_preferred when ready", () => {
    expect(resolveConduitHttpTransportMode(descriptor("tor_preferred"), torReady)).toBe("socks");
  });

  it("falls back to direct for tor_preferred when Tor down", () => {
    expect(resolveConduitHttpTransportMode(descriptor("tor_preferred"), torDown)).toBe("direct");
  });

  it("uses socks for tor_required when ready", () => {
    expect(resolveConduitHttpTransportMode(descriptor("tor_required"), torReady)).toBe("socks");
  });

  it("blocks tor_required when Tor down or missing proxyUrl", () => {
    expect(resolveConduitHttpTransportMode(descriptor("tor_required"), torDown)).toBe("blocked");
    expect(resolveConduitHttpTransportMode(descriptor("tor_required"), {
      configured: true,
      ready: true,
    })).toBe("blocked");
  });

  it("detects onion endpoints", () => {
    expect(isOnionMeshEndpoint("http://abcdef.onion:8788")).toBe(true);
    expect(isOnionMeshEndpoint("http://127.0.0.1:8788")).toBe(false);
  });
});
