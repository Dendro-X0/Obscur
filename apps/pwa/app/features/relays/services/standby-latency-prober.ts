/**
 * standby-latency-prober.ts
 *
 * Measures round-trip latency to a relay URL without subscribing or publishing.
 *
 * Strategy:
 *  - Open a WebSocket to the relay.
 *  - Wait for the first frame from the server (typically a NOTICE or any relay
 *    greeting).  Many relays send NOTICE on connect; if none arrives within
 *    the timeout we fall back to measuring just the open-handshake time.
 *  - Record elapsed ms from open-start to first-frame-received.
 *  - Close the socket immediately after measurement.
 *
 * This is intentionally lightweight: no AUTH, no REQ, no EVENT.
 * It must never affect the primary relay connection.
 */

export type StandbyProbeResult = Readonly<{
  url: string;
  latencyMs: number;
  ok: boolean;
  errorMessage?: string;
}>;

const DEFAULT_TIMEOUT_MS = 6_000;
const OPEN_ONLY_TIMEOUT_MS = 3_000;

/**
 * Probes a single relay URL and returns latency.
 *
 * @param url        - wss:// relay URL to probe
 * @param timeoutMs  - maximum ms to wait for a server frame (default 6 s)
 * @param wsFactory  - injectable WebSocket constructor for testing
 */
export const probeStandbyRelayLatency = (
  url: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  wsFactory: (url: string) => WebSocket = (u) => new WebSocket(u),
): Promise<StandbyProbeResult> => {
  return new Promise((resolve) => {
    const startMs = Date.now();
    let settled = false;

    const settle = (result: StandbyProbeResult): void => {
      if (settled) return;
      settled = true;
      clearTimeout(frameTimer);
      clearTimeout(openTimer);
      const socket = ws;
      window.setTimeout(() => {
        try {
          if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
            socket.close(1000, "probe-complete");
          }
        } catch {
          /* ignore */
        }
      }, 0);
      resolve(result);
    };

    let ws: WebSocket;
    try {
      ws = wsFactory(url);
    } catch (err) {
      resolve({
        url,
        latencyMs: 0,
        ok: false,
        errorMessage: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    const frameTimer = setTimeout(() => {
      settle({ url, latencyMs: Date.now() - startMs, ok: true });
    }, timeoutMs);

    const openTimer = setTimeout(() => {
      settle({ url, latencyMs: 0, ok: false, errorMessage: "open timeout" });
    }, OPEN_ONLY_TIMEOUT_MS);

    ws.onopen = (_ev: Event) => {
      clearTimeout(openTimer);
    };

    ws.onmessage = (_ev: MessageEvent) => {
      settle({ url, latencyMs: Date.now() - startMs, ok: true });
    };

    ws.onerror = (_ev: Event) => {
      settle({ url, latencyMs: 0, ok: false, errorMessage: "websocket error" });
    };

    ws.onclose = (evt: CloseEvent) => {
      if (!settled) {
        settle({
          url,
          latencyMs: 0,
          ok: false,
          errorMessage: evt.reason || "closed before frame",
        });
      }
    };
  });
};
