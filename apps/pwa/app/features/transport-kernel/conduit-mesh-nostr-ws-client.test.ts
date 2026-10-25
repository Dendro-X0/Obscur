import { beforeEach, describe, expect, it, vi } from "vitest";

import { isNostrEventWirePayload } from "@obscur/conduit-mesh-contracts/nostr-wire-payload";

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

  send(payload?: string): void {
    void payload;
  }

  close(): void {
    this.readyState = MockRelaySocket.CLOSED;
    this.onclose?.call(this as unknown as WebSocket, new CloseEvent("close"));
  }
}

describe("conduit-mesh-nostr-ws-client", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    MockRelaySocket.instances = [];
    relaySocketMocks.createRelayWebSocket.mockImplementation((url: string) => new MockRelaySocket(url));
    const { clearProcessPublicWarmupDials } = await import(
      "@/app/features/relays/services/relay-warmup-dial-cap"
    );
    clearProcessPublicWarmupDials();
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

    // Slice 2b: public-only pool dials zero Quiet (cap=0); private still uses factory.
    expect(relaySocketMocks.createRelayWebSocket).not.toHaveBeenCalled();
    expect(client.getConnectionSnapshots()).toEqual([]);
    client.setRelayUrls(["ws://localhost:7000", "wss://nos.lol"]);
    expect(relaySocketMocks.createRelayWebSocket).toHaveBeenCalledTimes(1);
    expect(relaySocketMocks.createRelayWebSocket).toHaveBeenCalledWith("ws://localhost:7000");
  });

  it("Slice 2b: public-only Quiet URLs do not dial under cap=0", async () => {
    const { createConduitMeshNostrWsClient } = await import("./conduit-mesh-nostr-ws-client");
    const first = createConduitMeshNostrWsClient();
    const second = createConduitMeshNostrWsClient();

    first.setRelayUrls(["wss://nos.lol"]);
    second.setRelayUrls(["wss://relay.primal.net"]);

    expect(relaySocketMocks.createRelayWebSocket).not.toHaveBeenCalled();
    first.dispose();
    second.dispose();
  });

  it("records connection success on open (P3 sample wiring)", async () => {
    const { createConduitMeshNostrWsClient } = await import("./conduit-mesh-nostr-ws-client");
    const client = createConduitMeshNostrWsClient();
    client.setRelayUrls(["ws://localhost:7000"]);

    const socket = MockRelaySocket.instances[0]!;
    socket.onopen?.call(socket as unknown as WebSocket, new Event("open"));

    expect(healthMocks.recordConnectionSuccess).toHaveBeenCalledTimes(1);
    expect(healthMocks.recordConnectionSuccess).toHaveBeenCalledWith("ws://localhost:7000");
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
    client.setRelayUrls(["ws://localhost:7000"]);

    const socket = MockRelaySocket.instances[0]!;
    socket.onopen?.call(socket as unknown as WebSocket, new Event("open"));
    healthMocks.recordConnectionFailure.mockClear();

    socket.onclose?.call(socket as unknown as WebSocket, new CloseEvent("close"));

    expect(healthMocks.recordDisconnection).toHaveBeenCalledWith("ws://localhost:7000");
    expect(healthMocks.recordConnectionFailure).not.toHaveBeenCalled();
    expect(client.getConnectionSnapshots()[0]?.status).toBe("closed");
  });

  it("accepts OK that arrives synchronously during send (local relay race)", async () => {
    const { createConduitMeshNostrWsClient } = await import("./conduit-mesh-nostr-ws-client");
    const client = createConduitMeshNostrWsClient({ connectTimeoutMs: 200 });
    client.setRelayUrls(["ws://localhost:7000"]);

    const socket = MockRelaySocket.instances[0]!;
    socket.readyState = MockRelaySocket.OPEN;
    socket.onopen?.call(socket as unknown as WebSocket, new Event("open"));

    const eventId = "evt-sync-ok-race";
    const payload = JSON.stringify(["EVENT", { id: eventId, kind: 4, content: "x", pubkey: "ab", created_at: 1, tags: [], sig: "cd" }]);
    socket.send = () => {
      socket.onmessage?.call(
        socket as unknown as WebSocket,
        new MessageEvent("message", { data: JSON.stringify(["OK", eventId, true, ""]) }),
      );
    };

    const result = await client.publish("ws://localhost:7000", payload);
    expect(result.accepted).toBe(true);
    expect(result.eventId).toBe(eventId);
    expect(result.errorMessage).toBeUndefined();
  });

  it("re-arms REQ on socket open when subscribe ran while connecting (F-RECV-LIVE)", async () => {
    const { createConduitMeshNostrWsClient } = await import("./conduit-mesh-nostr-ws-client");
    const client = createConduitMeshNostrWsClient();
    client.setRelayUrls(["ws://localhost:7000"]);

    const socket = MockRelaySocket.instances[0]!;
    const sent: string[] = [];
    socket.send = (payload: string) => {
      sent.push(payload);
    };

    const pubkey = "e".repeat(64);
    const received: Array<{ id: string; url: string }> = [];
    client.subscribe(
      [{ kinds: [4, 1059], "#p": [pubkey], limit: 50 }],
      (event, url) => {
        received.push({ id: String(event.id ?? ""), url });
      },
    );

    // Still connecting — no REQ on wire yet
    expect(sent).toHaveLength(0);

    socket.readyState = MockRelaySocket.OPEN;
    socket.onopen?.call(socket as unknown as WebSocket, new Event("open"));

    expect(sent).toHaveLength(1);
    const req = JSON.parse(sent[0]!) as unknown[];
    expect(req[0]).toBe("REQ");
    expect(req[1]).toMatch(/^mesh-sub-/);
    expect(req[2]).toEqual(expect.objectContaining({
      kinds: [4, 1059],
      "#p": [pubkey],
    }));

    // Live EVENT after re-arm must reach the handler
    socket.onmessage?.call(
      socket as unknown as WebSocket,
      new MessageEvent("message", {
        data: JSON.stringify([
          "EVENT",
          req[1],
          {
            id: "live-dm-1",
            kind: 4,
            pubkey: "a".repeat(64),
            created_at: 1,
            tags: [["p", pubkey]],
            content: "cipher",
            sig: "b".repeat(128),
          },
        ]),
      }),
    );

    expect(received).toEqual([{ id: "live-dm-1", url: "ws://localhost:7000" }]);
  });

  it("resubscribeAll re-sends REQ to every open socket", async () => {
    const { createConduitMeshNostrWsClient } = await import("./conduit-mesh-nostr-ws-client");
    const client = createConduitMeshNostrWsClient();
    client.setRelayUrls(["ws://localhost:7000", "ws://127.0.0.1:7001"]);

    const sentByUrl = new Map<string, string[]>();
    for (const socket of MockRelaySocket.instances) {
      sentByUrl.set(socket.url, []);
      socket.send = (payload: string) => {
        sentByUrl.get(socket.url)!.push(payload);
      };
      socket.readyState = MockRelaySocket.OPEN;
      socket.onopen?.call(socket as unknown as WebSocket, new Event("open"));
    }

    client.subscribe([{ kinds: [4], "#p": ["c".repeat(64)] }], () => undefined);
    for (const payloads of sentByUrl.values()) {
      payloads.length = 0;
    }

    client.resubscribeAll();

    for (const payloads of sentByUrl.values()) {
      expect(payloads).toHaveLength(1);
      expect(JSON.parse(payloads[0]!)[0]).toBe("REQ");
    }
  });

  it("forceReconnectAll tears down sockets and redials provided URLs", async () => {
    const { createConduitMeshNostrWsClient } = await import("./conduit-mesh-nostr-ws-client");
    const client = createConduitMeshNostrWsClient();
    client.setRelayUrls(["ws://localhost:7000"]);
    const first = MockRelaySocket.instances[0]!;
    first.readyState = MockRelaySocket.OPEN;
    first.onopen?.call(first as unknown as WebSocket, new Event("open"));

    const closeSpy = vi.spyOn(first, "close");
    client.forceReconnectAll(["ws://localhost:7000", "wss://nos.lol"]);

    expect(closeSpy).toHaveBeenCalled();
    expect(relaySocketMocks.createRelayWebSocket).toHaveBeenCalledWith("ws://localhost:7000");
    expect(client.getConnectionSnapshots()).toEqual([
      expect.objectContaining({ url: "ws://localhost:7000", status: "connecting" }),
    ]);
    expect(relaySocketMocks.createRelayWebSocket).not.toHaveBeenCalledWith("wss://nos.lol");
    client.dispose();
  });

  it("forceReconnectAll with empty prior map still dials explicit private URLs", async () => {
    const { createConduitMeshNostrWsClient } = await import("./conduit-mesh-nostr-ws-client");
    const client = createConduitMeshNostrWsClient();
    client.forceReconnectAll(["ws://localhost:7000"]);
    expect(relaySocketMocks.createRelayWebSocket).toHaveBeenCalledWith("ws://localhost:7000");
    expect(client.getConnectionSnapshots()[0]?.status).toBe("connecting");
  });
});
