import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearProcessPublicWarmupDials } from "@/app/features/relays/services/relay-warmup-dial-cap";

const runtimeMocks = vi.hoisted(() => ({
  hasNativeRuntime: vi.fn(),
}));

const relayMocks = vi.hoisted(() => ({
  NativeRelay: vi.fn(),
}));

vi.mock("@/app/features/runtime/runtime-capabilities", () => ({
  hasNativeRuntime: runtimeMocks.hasNativeRuntime,
}));

vi.mock("./native-relay", () => ({
  NativeRelay: relayMocks.NativeRelay,
}));

import { createRelayWebSocket } from "./create-relay-websocket";

describe("create-relay-websocket", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearProcessPublicWarmupDials();
  });

  it("uses browser WebSocket in non-native runtime", () => {
    runtimeMocks.hasNativeRuntime.mockReturnValue(false);
    const browserSocket = { kind: "browser" };
    const WebSocketMock = vi.fn(function WebSocketMock() {
      return browserSocket;
    }) as any;
    const wsSpy = vi.spyOn(globalThis, "WebSocket").mockImplementation(WebSocketMock);

    const socket = createRelayWebSocket("wss://relay.example");

    expect(wsSpy).toHaveBeenCalledWith("wss://relay.example");
    expect(relayMocks.NativeRelay).not.toHaveBeenCalled();
    expect(socket).toBe(browserSocket as any);
  });

  it("uses NativeRelay in native runtime for non-Quiet hosts", () => {
    runtimeMocks.hasNativeRuntime.mockReturnValue(true);
    const nativeSocket = { kind: "native", close: vi.fn() };
    relayMocks.NativeRelay.mockImplementation(function NativeRelayMock() {
      return nativeSocket;
    });

    const socket = createRelayWebSocket("wss://relay.example");

    expect(relayMocks.NativeRelay).toHaveBeenCalledWith("wss://relay.example");
    expect(socket).toBe(nativeSocket as any);
  });

  it("Slice 2b: refuses all Quiet NativeRelay dials under cap=0", () => {
    runtimeMocks.hasNativeRuntime.mockReturnValue(true);
    const nativeSocket = { kind: "native", close: vi.fn() };
    relayMocks.NativeRelay.mockImplementation(function NativeRelayMock() {
      return nativeSocket;
    });

    const first = createRelayWebSocket("wss://nos.lol");
    const second = createRelayWebSocket("wss://relay.primal.net");

    expect(relayMocks.NativeRelay).not.toHaveBeenCalled();
    expect((first as { readyState: number }).readyState).toBe(3);
    expect((second as { readyState: number }).readyState).toBe(3);
  });
});
