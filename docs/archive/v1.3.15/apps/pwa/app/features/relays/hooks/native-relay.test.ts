import { beforeEach, describe, expect, it, vi } from "vitest";

const adapterMocks = vi.hoisted(() => ({
  getTorStatus: vi.fn(),
  connectRelay: vi.fn(),
  probeRelay: vi.fn(),
  subscribeRelay: vi.fn(),
  unsubscribeRelay: vi.fn(),
  sendRelayMessage: vi.fn(),
  disconnectRelay: vi.fn(),
  listenRelayStatus: vi.fn(),
  listenRelayEvent: vi.fn(),
}));

const errorStoreMocks = vi.hoisted(() => ({
  addError: vi.fn(),
}));

const healthMocks = vi.hoisted(() => ({
  recordConnectionSuccess: vi.fn(),
  recordConnectionFailure: vi.fn(),
}));

vi.mock("./relay-native-adapter", () => ({
  relayNativeAdapter: adapterMocks,
}));

vi.mock("../../native/lib/native-error-store", () => ({
  nativeErrorStore: errorStoreMocks,
}));

vi.mock("./relay-health-monitor", () => ({
  relayHealthMonitor: healthMocks,
}));

import { NativeRelay } from "./native-relay";

const torConfiguredStatus = {
  state: "connected",
  configured: true,
  ready: true,
  usingExternalInstance: false,
  proxyUrl: "socks5h://127.0.0.1:9050",
} as const;

const torDisabledStatus = {
  state: "disconnected",
  configured: false,
  ready: false,
  usingExternalInstance: false,
  proxyUrl: "",
} as const;

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  public readyState = MockWebSocket.CONNECTING;
  public binaryType: BinaryType = "blob";
  public onopen: ((event: Event) => void) | null = null;
  public onmessage: ((event: MessageEvent) => void) | null = null;
  public onerror: ((event: Event) => void) | null = null;
  public onclose: ((event: CloseEvent) => void) | null = null;

  constructor(public readonly url: string) {
    MockWebSocket.instances.push(this);
  }

  send(): void {}

  close(): void {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.(new CloseEvent("close", { wasClean: true }));
  }
}

const flushRelayInit = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
};

describe("NativeRelay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MockWebSocket.instances = [];
    vi.stubGlobal("WebSocket", MockWebSocket as unknown as typeof WebSocket);
  });

  it("uses native adapter path when tor is enabled", async () => {
    adapterMocks.getTorStatus.mockResolvedValue(torConfiguredStatus);
    adapterMocks.listenRelayStatus.mockResolvedValue(() => undefined);
    adapterMocks.listenRelayEvent.mockResolvedValue(() => undefined);
    adapterMocks.connectRelay.mockResolvedValue("Already connected");

    const relay = new NativeRelay("wss://relay.example");
    await flushRelayInit();

    expect(adapterMocks.listenRelayStatus).toHaveBeenCalledTimes(1);
    expect(adapterMocks.listenRelayEvent).toHaveBeenCalledTimes(1);
    expect(adapterMocks.connectRelay).toHaveBeenCalledWith("wss://relay.example");
    expect(relay.readyState).toBe(NativeRelay.OPEN);
  });

  it("prefers browser websocket path on desktop when tor is disabled", async () => {
    adapterMocks.getTorStatus.mockResolvedValue(torDisabledStatus);

    const relay = new NativeRelay("wss://relay.example");
    await flushRelayInit();

    expect(adapterMocks.listenRelayStatus).not.toHaveBeenCalled();
    expect(adapterMocks.listenRelayEvent).not.toHaveBeenCalled();
    expect(adapterMocks.connectRelay).not.toHaveBeenCalled();
    expect(MockWebSocket.instances).toHaveLength(1);
    const browserSocket = MockWebSocket.instances[0];
    browserSocket?.onopen?.(new Event("open"));

    expect(relay.readyState).toBe(NativeRelay.OPEN);
  });

  it("does not call native connect when tor is disabled", async () => {
    adapterMocks.getTorStatus.mockResolvedValue(torDisabledStatus);

    const relay = new NativeRelay("wss://relay.example");
    await flushRelayInit();

    expect(adapterMocks.connectRelay).not.toHaveBeenCalled();
    expect(MockWebSocket.instances).toHaveLength(1);
    const browserSocket = MockWebSocket.instances[0];
    browserSocket?.onopen?.(new Event("open"));

    expect(relay.readyState).toBe(NativeRelay.OPEN);
    expect(errorStoreMocks.addError).not.toHaveBeenCalledWith(
      expect.objectContaining({ code: "RELAY_CONNECT_FAILED" }),
    );
  });

  it("routes subscription messages through relay adapter", async () => {
    adapterMocks.getTorStatus.mockResolvedValue(torConfiguredStatus);
    adapterMocks.listenRelayStatus.mockResolvedValue(() => undefined);
    adapterMocks.listenRelayEvent.mockResolvedValue(() => undefined);
    adapterMocks.connectRelay.mockResolvedValue("Already connected");

    const relay = new NativeRelay("wss://relay.example");
    await flushRelayInit();

    await relay.send(JSON.stringify(["REQ", "sub-1", { kinds: [1] }]));
    await relay.send(JSON.stringify(["CLOSE", "sub-1"]));

    expect(adapterMocks.subscribeRelay).toHaveBeenCalledWith("wss://relay.example", "sub-1", { kinds: [1] });
    expect(adapterMocks.unsubscribeRelay).toHaveBeenCalledWith("wss://relay.example", "sub-1");
  });

  it("does not call native disconnect when closed before browser fallback initialization finishes", async () => {
    let resolveTorStatus: ((value: typeof torDisabledStatus) => void) | undefined;
    adapterMocks.getTorStatus.mockImplementation(() => new Promise((resolve) => {
      resolveTorStatus = resolve;
    }));

    const relay = new NativeRelay("wss://relay.example");
    await relay.close();
    resolveTorStatus?.(torDisabledStatus);
    await flushRelayInit();

    expect(adapterMocks.disconnectRelay).not.toHaveBeenCalled();
    expect(relay.readyState).toBe(NativeRelay.CLOSED);
  });

  it("marks browser fallback as closed after websocket error so reconnect logic can replace it", async () => {
    adapterMocks.getTorStatus.mockResolvedValue(torDisabledStatus);
    adapterMocks.listenRelayStatus.mockRejectedValue(new Error("native listen failed"));

    const relay = new NativeRelay("wss://relay.example");
    await flushRelayInit();

    const browserSocket = MockWebSocket.instances[0];
    expect(browserSocket).toBeDefined();

    browserSocket?.onerror?.(new Event("error"));

    expect(relay.readyState).toBe(NativeRelay.CLOSED);
    expect(healthMocks.recordConnectionFailure).toHaveBeenCalledWith("wss://relay.example", "WebSocket error");
  });

  it("emits structured connect failure detail for native hard failures without bypassing tor diagnostics", async () => {
    adapterMocks.getTorStatus.mockResolvedValue(torConfiguredStatus);
    adapterMocks.listenRelayStatus.mockResolvedValue(() => undefined);
    adapterMocks.listenRelayEvent.mockResolvedValue(() => undefined);
    adapterMocks.connectRelay.mockRejectedValue(new Error("Tor proxy connect failed: HTTP error: 403 Forbidden"));
    const relay = new NativeRelay("wss://relay.example");
    const onError = vi.fn();
    relay.addEventListener("error", onError);
    await flushRelayInit();

    expect(relay.readyState).toBe(NativeRelay.CLOSED);
    expect(onError).toHaveBeenCalledTimes(1);
    const errorEvent = onError.mock.calls[0]?.[0] as CustomEvent<{ message?: string }>;
    expect(errorEvent.detail?.message).toContain("Tor proxy connect failed");
    expect(adapterMocks.probeRelay).not.toHaveBeenCalled();
  });

  it("does not issue duplicate native disconnect calls on repeated close", async () => {
    adapterMocks.getTorStatus.mockResolvedValue(torConfiguredStatus);
    adapterMocks.listenRelayStatus.mockResolvedValue(() => undefined);
    adapterMocks.listenRelayEvent.mockResolvedValue(() => undefined);
    adapterMocks.connectRelay.mockResolvedValue("Already connected");

    const relay = new NativeRelay("wss://relay.example");
    await flushRelayInit();

    await relay.close();
    await relay.close();

    expect(adapterMocks.disconnectRelay).toHaveBeenCalledTimes(1);
  });

  it("marks relay closed when native send reports not connected", async () => {
    adapterMocks.getTorStatus.mockResolvedValue(torConfiguredStatus);
    adapterMocks.listenRelayStatus.mockResolvedValue(() => undefined);
    adapterMocks.listenRelayEvent.mockResolvedValue(() => undefined);
    adapterMocks.connectRelay.mockResolvedValue("Already connected");
    adapterMocks.sendRelayMessage.mockRejectedValue(new Error("Not connected"));

    const relay = new NativeRelay("wss://relay.example");
    const onClose = vi.fn();
    relay.addEventListener("close", onClose);
    await flushRelayInit();

    await relay.send(JSON.stringify(["EVENT", { id: "evt-1" }]));

    expect(relay.readyState).toBe(NativeRelay.CLOSED);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(errorStoreMocks.addError).not.toHaveBeenCalledWith(
      expect.objectContaining({ code: "RELAY_SEND_FAILED" }),
    );
  });

  it("marks relay closed when native send times out", async () => {
    adapterMocks.getTorStatus.mockResolvedValue(torConfiguredStatus);
    adapterMocks.listenRelayStatus.mockResolvedValue(() => undefined);
    adapterMocks.listenRelayEvent.mockResolvedValue(() => undefined);
    adapterMocks.connectRelay.mockResolvedValue("Already connected");
    adapterMocks.sendRelayMessage.mockRejectedValue(new Error("Native command send_relay_message timed out after 8000ms"));

    const relay = new NativeRelay("wss://relay.example");
    const onClose = vi.fn();
    relay.addEventListener("close", onClose);
    await flushRelayInit();

    await relay.send(JSON.stringify(["EVENT", { id: "evt-timeout" }]));

    expect(relay.readyState).toBe(NativeRelay.CLOSED);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(errorStoreMocks.addError).not.toHaveBeenCalledWith(
      expect.objectContaining({ code: "RELAY_SEND_FAILED" }),
    );
  });

  it("emits open once when status connected arrives before connect returns already connected", async () => {
    adapterMocks.getTorStatus.mockResolvedValue(torConfiguredStatus);
    let statusHandler: ((event: { payload?: { url: string; status: "connected" | "disconnected" | "error" | "starting" } }) => void) | undefined;
    let resolveConnect: ((value: string) => void) | undefined;

    adapterMocks.listenRelayStatus.mockImplementation(async (handler) => {
      statusHandler = handler as (event: { payload?: { url: string; status: "connected" | "disconnected" | "error" | "starting" } }) => void;
      return () => undefined;
    });
    adapterMocks.listenRelayEvent.mockResolvedValue(() => undefined);
    adapterMocks.connectRelay.mockImplementation(
      () => new Promise<string>((resolve) => {
        resolveConnect = resolve;
      })
    );

    const relay = new NativeRelay("wss://relay.example");
    const onOpen = vi.fn();
    relay.addEventListener("open", onOpen);
    await flushRelayInit();

    if (typeof statusHandler !== "function" || typeof resolveConnect !== "function") {
      throw new Error("Native relay hooks were not initialized");
    }

    statusHandler({ payload: { url: "wss://relay.example", status: "connected" } });
    resolveConnect("Already connected");
    await flushRelayInit();

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("disposes stale native handle without issuing native disconnect", async () => {
    adapterMocks.getTorStatus.mockResolvedValue(torConfiguredStatus);
    adapterMocks.listenRelayStatus.mockResolvedValue(() => undefined);
    adapterMocks.listenRelayEvent.mockResolvedValue(() => undefined);
    adapterMocks.connectRelay.mockResolvedValue("Already connected");

    const relay = new NativeRelay("wss://relay.example");
    await flushRelayInit();

    relay.disposeStaleHandle();

    expect(relay.readyState).toBe(NativeRelay.CLOSED);
    expect(adapterMocks.disconnectRelay).not.toHaveBeenCalled();
  });
});
