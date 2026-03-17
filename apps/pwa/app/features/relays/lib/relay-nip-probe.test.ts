import { describe, expect, it, vi } from "vitest";
import { runRelayNipProbe, summarizeRelayNipProbeResults } from "./relay-nip-probe.mjs";

class FakeWebSocket {
  public readyState = 1;
  private listeners = new Map<string, Set<(event: any) => void>>();

  constructor(_url: string) {
    queueMicrotask(() => {
      this.emit("open", {});
    });
  }

  addEventListener(event: string, handler: (event: any) => void): void {
    const set = this.listeners.get(event) ?? new Set<(event: any) => void>();
    set.add(handler);
    this.listeners.set(event, set);
  }

  removeEventListener(event: string, handler: (event: any) => void): void {
    this.listeners.get(event)?.delete(handler);
  }

  send(payload: string): void {
    const parsed = JSON.parse(payload);
    if (!Array.isArray(parsed)) return;
    if (parsed[0] === "EVENT") {
      const eventId = parsed[1]?.id;
      this.emit("message", {
        data: JSON.stringify(["OK", eventId, false, "invalid"]),
      });
      return;
    }
    if (parsed[0] === "REQ") {
      const subId = parsed[1];
      this.emit("message", {
        data: JSON.stringify(["EOSE", subId]),
      });
    }
  }

  close(): void {
    this.readyState = 3;
    this.emit("close", {});
  }

  private emit(event: string, payload: any): void {
    this.listeners.get(event)?.forEach((handler) => handler(payload));
  }
}

describe("relay-nip-probe", () => {
  it("probes relay socket/publish/subscribe and nip11 deterministically", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes(".well-known/nostr/nip96.json")) {
        return new Response(JSON.stringify({ api_url: "https://uploader.example/upload" }), { status: 200 });
      }
      if (url.includes("uploader.example/upload")) {
        return new Response(JSON.stringify({ status: "ok" }), { status: 401 });
      }
      return new Response(JSON.stringify({ name: "relay" }), { status: 200 });
    });

    const results = await runRelayNipProbe({
      relayUrls: ["wss://relay.example"],
      nip96Urls: ["https://uploader.example/upload"],
      timeoutMs: 1000,
      fetchImpl: fetchImpl as any,
      webSocketFactory: (url: string) => new FakeWebSocket(url) as unknown as WebSocket,
    });

    expect(results.find((entry) => entry.check === "relay_socket")?.status).toBe("ok");
    expect(results.find((entry) => entry.check === "relay_publish")?.status).toBe("degraded");
    expect(results.find((entry) => entry.check === "relay_publish")?.reasonCode).toBe("publish_rejected");
    expect(results.find((entry) => entry.check === "relay_subscribe")?.status).toBe("ok");
    expect(results.find((entry) => entry.check === "nip11_fetch")?.status).toBe("ok");
    expect(results.find((entry) => entry.check === "nip96_discovery")?.status).toBe("ok");
    expect(results.find((entry) => entry.check === "nip96_auth_precheck")?.reasonCode).toBe("nip96_auth_required");
  });

  it("classifies nip96 discovery 404 deterministically", async () => {
    const results = await runRelayNipProbe({
      relayUrls: [],
      nip96Urls: ["https://cdn.example/upload"],
      timeoutMs: 1000,
      fetchImpl: vi.fn(async () => new Response("missing", { status: 404 })) as any,
      webSocketFactory: (url: string) => new FakeWebSocket(url) as unknown as WebSocket,
    });

    const discovery = results.find((entry) => entry.check === "nip96_discovery");
    expect(discovery?.status).toBe("failed");
    expect(discovery?.reasonCode).toBe("nip96_discovery_missing");
  });

  it("summarizes statuses", () => {
    const summary = summarizeRelayNipProbeResults([
      { target: "a", check: "relay_socket", status: "ok", retryable: false },
      { target: "b", check: "relay_publish", status: "degraded", retryable: false },
      { target: "c", check: "relay_subscribe", status: "failed", retryable: true },
      { target: "d", check: "nip11_fetch", status: "unsupported", retryable: false },
    ]);
    expect(summary).toEqual({
      ok: 1,
      degraded: 1,
      failed: 1,
      unsupported: 1,
    });
  });
});
