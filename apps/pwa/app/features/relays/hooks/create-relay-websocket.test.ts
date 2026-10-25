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

  it("Slice 2b: caps Quiet NativeRelay dials at process budget (RELAY_WARMUP_PUBLIC_DIAL_CAP)", () => {
    runtimeMocks.hasNativeRuntime.mockReturnValue(true);
    const nativeSocket = { kind: "native", close: vi.fn() };
    relayMocks.NativeRelay.mockImplementation(function NativeRelayMock() {
      return nativeSocket;
    });

    const first = createRelayWebSocket("wss://nos.lol");
    const second = createRelayWebSocket("wss://relay.primal.net");
    const third = createRelayWebSocket("wss://relay.damus.io");

    expect(relayMocks.NativeRelay).toHaveBeenCalledTimes(2);
    expect(relayMocks.NativeRelay).toHaveBeenCalledWith("wss://nos.lol");
    expect(relayMocks.NativeRelay).toHaveBeenCalledWith("wss://relay.primal.net");
    expect(first).toBe(nativeSocket as any);
    expect(second).toBe(nativeSocket as any);
    expect((third as { readyState: number }).readyState).toBe(3);
  });
});

