import { beforeEach, describe, expect, it, vi } from "vitest";

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

  it("uses NativeRelay in native runtime", () => {
    runtimeMocks.hasNativeRuntime.mockReturnValue(true);
    const nativeSocket = { kind: "native" };
    relayMocks.NativeRelay.mockImplementation(function NativeRelayMock() {
      return nativeSocket;
    });

    const socket = createRelayWebSocket("wss://relay.example");

    expect(relayMocks.NativeRelay).toHaveBeenCalledWith("wss://relay.example");
    expect(socket).toBe(nativeSocket as any);
  });
});
