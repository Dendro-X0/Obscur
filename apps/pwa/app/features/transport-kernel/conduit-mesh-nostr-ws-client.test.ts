import { beforeEach, describe, expect, it, vi } from "vitest";

import { isNostrEventWirePayload } from "@obscur/conduit-mesh-contracts";

const relaySocketMocks = vi.hoisted(() => ({
  createRelayWebSocket: vi.fn(),
}));

const healthMocks = vi.hoisted(() => ({
  recordConnectionAttempt: vi.fn(),
  recordConnectionSuccess: vi.fn(),
  recordConnectionFailure: vi.fn(),
  recordDisconnection: vi.fn(),
}));

vi.mock("@/app/features/relays/hooks/create-relay-websocket", () => ({
  createRelayWebSocket: relaySocketMocks.createRelayWebSocket,
}));

vi.mock("@/app/features/relays/hooks/relay-health-monitor", () => ({
  relayHealthMonitor: healthMocks,
}));

class MockRelaySocket {
  static instances: MockRelaySocket[] = [];

  public readyState = MockRelaySocket.CONNECTING;
  public onopen: ((this: WebSocket, ev: Event) => void) | null = null;
  public onmessage: ((this: WebSocket, ev: MessageEvent) => void) | null = null;
  public onerror: ((this: WebSocket, ev: Event) => void) | null = null;
  public onclose: ((this: WebSocket, ev: CloseEvent) => void) | null = null;

  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 3;

  constructor(public readonly url: string) {
    MockRelaySocket.instances.push(this);
  }

  send(): void {}

  close(): void {
    this.readyState = MockRelaySocket.CLOSED;
    this.onclose?.call(this as unknown as WebSocket, new CloseEvent("close"));
  }
}

describe("conduit-mesh-nostr-ws-client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MockRelaySocket.instances = [];
    relaySocketMocks.createRelayWebSocket.mockImplementation((url: string) => new MockRelaySocket(url));
  });

  it("exports a factory for live client wiring", async () => {
    const module = await import("./conduit-mesh-nostr-ws-client");
    expect(typeof module.createConduitMeshNostrWsClient).toBe("function");
  });

  it("documents passthrough contract used by mesh publish path", () => {
    const payload = JSON.stringify(["EVENT", { id: "live-event", kind: 4 }]);
    expect(isNostrEventWirePayload(payload)).toBe(true);
  });

  it("opens public relays through createRelayWebSocket instead of raw browser WebSocket", async () => {
    const { createConduitMeshNostrWsClient } = await import("./conduit-mesh-nostr-ws-client");
    const client = createConduitMeshNostrWsClient();

    client.setRelayUrls(["wss://relay.damus.io", "wss://nos.lol"]);

    expect(relaySocketMocks.createRelayWebSocket).toHaveBeenCalledTimes(2);
    expect(relaySocketMocks.createRelayWebSocket).toHaveBeenCalledWith("wss://relay.damus.io");
    expect(relaySocketMocks.createRelayWebSocket).toHaveBeenCalledWith("wss://nos.lol");
    expect(client.getConnectionSnapshots()).toEqual([
      expect.objectContaining({ url: "wss://relay.damus.io", status: "connecting" }),
      expect.objectContaining({ url: "wss://nos.lol", status: "connecting" }),
    ]);
    expect(healthMocks.recordConnectionAttempt).toHaveBeenCalledWith("wss://relay.damus.io");
    expect(healthMocks.recordConnectionAttempt).toHaveBeenCalledWith("wss://nos.lol");
  });

  it("records connection success on open (P3 sample wiring)", async () => {
    const { createConduitMeshNostrWsClient } = await import("./conduit-mesh-nostr-ws-client");
    const client = createConduitMeshNostrWsClient();
    client.setRelayUrls(["wss://nos.lol"]);

    const socket = MockRelaySocket.instances[0]!;
    socket.onopen?.call(socket as unknown as WebSocket, new Event("open"));

    expect(healthMocks.recordConnectionSuccess).toHaveBeenCalledTimes(1);
    expect(healthMocks.recordConnectionSuccess).toHaveBeenCalledWith("wss://nos.lol");
    expect(healthMocks.recordConnectionFailure).not.toHaveBeenCalled();
    expect(client.getConnectionSnapshots()[0]?.status).toBe("open");
  });

  it("records a single failure on connect timeout", async () => {
    vi.useFakeTimers();
    const { createConduitMeshNostrWsClient } = await import("./conduit-mesh-nostr-ws-client");
    const client = createConduitMeshNostrWsClient({ connectTimeoutMs: 50 });
    client.setRelayUrls(["wss://slow.example"]);

    await vi.advanceTimersByTimeAsync(50);

    expect(healthMocks.recordConnectionFailure).toHaveBeenCalledTimes(1);
    expect(healthMocks.recordConnectionFailure).toHaveBeenCalledWith("wss://slow.example", "connect_timeout");
    expect(healthMocks.recordConnectionSuccess).not.toHaveBeenCalled();
    expect(client.getConnectionSnapshots()[0]?.status).toBe("closed");
    vi.useRealTimers();
  });

  it("records disconnection without failure when an open socket closes", async () => {
    const { createConduitMeshNostrWsClient } = await import("./conduit-mesh-nostr-ws-client");
    const client = createConduitMeshNostrWsClient();
    client.setRelayUrls(["wss://nos.lol"]);

    const socket = MockRelaySocket.instances[0]!;
    socket.onopen?.call(socket as unknown as WebSocket, new Event("open"));
    healthMocks.recordConnectionFailure.mockClear();

    socket.onclose?.call(socket as unknown as WebSocket, new CloseEvent("close"));

    expect(healthMocks.recordDisconnection).toHaveBeenCalledWith("wss://nos.lol");
    expect(healthMocks.recordConnectionFailure).not.toHaveBeenCalled();
    expect(client.getConnectionSnapshots()[0]?.status).toBe("closed");
  });
});
