import { describe, expect, it, vi } from "vitest";

import {
  createConduitMeshTorHostPort,
  fetchConduitMeshTorHostState,
  mapTorStatusToMeshTorState,
} from "./conduit-mesh-tor-host-port";

describe("conduit-mesh-tor-host-port", () => {
  it("maps TorStatusSnapshot to mesh tor state", () => {
    const mapped = mapTorStatusToMeshTorState({
      state: "connected",
      configured: true,
      ready: true,
      usingExternalInstance: false,
      proxyUrl: "socks5h://127.0.0.1:9050",
    });

    expect(mapped.configured).toBe(true);
    expect(mapped.ready).toBe(true);
    expect(mapped.proxyUrl).toBe("socks5h://127.0.0.1:9050");
  });

  it("fetchConduitMeshTorHostState uses injected fetch", async () => {
    const fetchTorStatus = vi.fn(async () => ({
      state: "disconnected" as const,
      configured: true,
      ready: false,
      usingExternalInstance: false,
      proxyUrl: "socks5h://127.0.0.1:9050",
    }));

    const state = await fetchConduitMeshTorHostState(fetchTorStatus);
    expect(state.ready).toBe(false);
    expect(fetchTorStatus).toHaveBeenCalledTimes(1);
  });

  it("createConduitMeshTorHostPort returns async getTorState", async () => {
    const port = createConduitMeshTorHostPort(async () => ({
      state: "connected",
      configured: false,
      ready: false,
      usingExternalInstance: false,
      proxyUrl: "",
    }));

    const state = await port.getTorState();
    expect(state.configured).toBe(false);
    expect(state.ready).toBe(false);
  });
});
