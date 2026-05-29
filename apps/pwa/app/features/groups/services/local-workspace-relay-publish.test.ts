import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { publishViaEphemeralLocalWorkspaceSocket } from "./local-workspace-relay-publish";

class MockWebSocket {
  static readonly OPEN = 1;
  readyState = MockWebSocket.OPEN;
  send = vi.fn();
  close = vi.fn();
  private readonly handlers = new Map<string, Set<(event?: unknown) => void>>();

  constructor(public readonly url: string) {
    queueMicrotask(() => this.emit("open"));
  }

  addEventListener(type: string, handler: (event?: unknown) => void): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);
  }

  emit(type: string, event?: unknown): void {
    this.handlers.get(type)?.forEach((handler) => handler(event));
  }
}

describe("publishViaEphemeralLocalWorkspaceSocket", () => {
  let lastSocket: MockWebSocket | null;

  beforeEach(() => {
    lastSocket = null;
    vi.stubGlobal("WebSocket", class extends MockWebSocket {
      constructor(url: string) {
        super(url);
        lastSocket = this;
      }
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("accepts OK true from loopback relay", async () => {
    const payload = JSON.stringify(["EVENT", { id: "abc123" }]);
    const promise = publishViaEphemeralLocalWorkspaceSocket("localhost:7000", payload, 2000);
    await vi.waitFor(() => expect(lastSocket).not.toBeNull());
    lastSocket!.emit("message", { data: JSON.stringify(["OK", "abc123", true, ""]) });
    const result = await promise;
    expect(result.success).toBe(true);
    expect(result.relayUrl).toBe("ws://localhost:7000");
  });

  it("treats duplicate rejection as success on loopback", async () => {
    const payload = JSON.stringify(["EVENT", { id: "abc123" }]);
    const promise = publishViaEphemeralLocalWorkspaceSocket("ws://127.0.0.1:7000", payload, 2000);
    await vi.waitFor(() => expect(lastSocket).not.toBeNull());
    lastSocket!.emit("message", { data: JSON.stringify(["OK", "abc123", false, "duplicate: event exists"]) });
    const result = await promise;
    expect(result.success).toBe(true);
  });

  it("returns relay rejection message when not duplicate", async () => {
    const payload = JSON.stringify(["EVENT", { id: "abc123" }]);
    const promise = publishViaEphemeralLocalWorkspaceSocket("localhost:7000", payload, 2000);
    await vi.waitFor(() => expect(lastSocket).not.toBeNull());
    lastSocket!.emit("message", { data: JSON.stringify(["OK", "abc123", false, "invalid: bad signature"]) });
    const result = await promise;
    expect(result.success).toBe(false);
    expect(result.error).toContain("bad signature");
  });
});
