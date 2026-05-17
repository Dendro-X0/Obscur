const DEFAULT_TIMEOUT_MS = 5000;

/**
 * @typedef {"relay_socket"|"relay_publish"|"relay_subscribe"|"nip11_fetch"|"nip96_discovery"|"nip96_auth_precheck"} RelayNipProbeCheck
 * @typedef {"ok"|"degraded"|"failed"|"unsupported"} RelayNipProbeStatus
 * @typedef {{
 *   target: string;
 *   check: RelayNipProbeCheck;
 *   status: RelayNipProbeStatus;
 *   reasonCode?: string;
 *   retryable: boolean;
 *   latencyMs?: number;
 *   message?: string;
 * }} RelayNipProbeResult
 * @typedef {{
 *   relayUrls: readonly string[];
 *   nip96Urls?: readonly string[];
 *   timeoutMs?: number;
 *   fetchImpl?: typeof fetch;
 *   webSocketFactory?: (url: string) => WebSocket;
 * }} RelayNipProbeParams
 */

const nowUnixMs = () => Date.now();

const toHttpRelayUrl = (relayUrl) => {
  if (relayUrl.startsWith("wss://")) return `https://${relayUrl.slice(6)}`;
  if (relayUrl.startsWith("ws://")) return `http://${relayUrl.slice(5)}`;
  return relayUrl;
};

const normalizeRelayUrls = (relayUrls) => {
  return Array.from(new Set(
    relayUrls
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
  ));
};

const normalizeNip96Urls = (urls) => {
  return Array.from(new Set(
    (urls || [])
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
  ));
};

const classifyFetchError = (error) => {
  const message = error instanceof Error ? error.message : String(error);
  if (/cors|access-control-allow-origin/i.test(message)) {
    return { reasonCode: "cors_blocked", retryable: false, message };
  }
  if (/timeout/i.test(message)) {
    return { reasonCode: "timeout", retryable: true, message };
  }
  return { reasonCode: "network_error", retryable: true, message };
};

const createResult = (params) => ({
  target: params.target,
  check: params.check,
  status: params.status,
  reasonCode: params.reasonCode,
  retryable: params.retryable,
  latencyMs: params.latencyMs,
  message: params.message,
});

const withTimeout = async (promise, timeoutMs, timeoutMessage = "Timed out") => {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const openRelaySocket = async (params) => {
  const startedAt = nowUnixMs();
  return await withTimeout(new Promise((resolve, reject) => {
    let settled = false;
    const ws = params.webSocketFactory(params.url);

    const cleanup = () => {
      ws.removeEventListener?.("open", handleOpen);
      ws.removeEventListener?.("error", handleError);
      ws.removeEventListener?.("close", handleClose);
    };

    const handleOpen = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({ ws, latencyMs: nowUnixMs() - startedAt });
    };
    const handleError = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("WebSocket open failed"));
    };
    const handleClose = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("WebSocket closed before ready"));
    };

    ws.addEventListener("open", handleOpen);
    ws.addEventListener("error", handleError);
    ws.addEventListener("close", handleClose);
  }), params.timeoutMs, "WebSocket open timeout");
};

const probeRelayPublish = async (params) => {
  const requestEventId = `probe-${Math.random().toString(36).slice(2, 10)}-${nowUnixMs()}`;
  const payload = JSON.stringify([
    "EVENT",
    {
      id: requestEventId,
      pubkey: "0".repeat(64),
      created_at: Math.floor(nowUnixMs() / 1000),
      kind: 1,
      tags: [],
      content: "probe",
      sig: "0".repeat(128),
    },
  ]);
  const startedAt = nowUnixMs();

  return await withTimeout(new Promise((resolve, reject) => {
    const onMessage = (event) => {
      if (typeof event.data !== "string") return;
      try {
        const parsed = JSON.parse(event.data);
        if (!Array.isArray(parsed) || parsed[0] !== "OK" || parsed[1] !== requestEventId) return;
        params.ws.removeEventListener("message", onMessage);
        const ok = parsed[2] === true;
        resolve({
          ok,
          reasonCode: ok ? undefined : "publish_rejected",
          message: typeof parsed[3] === "string" ? parsed[3] : undefined,
          latencyMs: nowUnixMs() - startedAt,
        });
      } catch {
        // Ignore non-JSON relay payloads.
      }
    };

    params.ws.addEventListener("message", onMessage);
    try {
      params.ws.send(payload);
    } catch (error) {
      params.ws.removeEventListener("message", onMessage);
      reject(error);
    }
  }), params.timeoutMs, "Relay publish probe timeout");
};

const probeRelaySubscribe = async (params) => {
  const subId = `probe-sub-${Math.random().toString(36).slice(2, 9)}`;
  const payload = JSON.stringify(["REQ", subId, { kinds: [0], limit: 1 }]);
  const startedAt = nowUnixMs();
  return await withTimeout(new Promise((resolve, reject) => {
    const onMessage = (event) => {
      if (typeof event.data !== "string") return;
      try {
        const parsed = JSON.parse(event.data);
        if (!Array.isArray(parsed)) return;
        if ((parsed[0] === "EVENT" || parsed[0] === "EOSE") && parsed[1] === subId) {
          params.ws.removeEventListener("message", onMessage);
          try {
            params.ws.send(JSON.stringify(["CLOSE", subId]));
          } catch {
            // Ignore close send errors.
          }
          resolve({ latencyMs: nowUnixMs() - startedAt });
        }
      } catch {
        // Ignore malformed payloads from unrelated relay traffic.
      }
    };
    params.ws.addEventListener("message", onMessage);
    try {
      params.ws.send(payload);
    } catch (error) {
      params.ws.removeEventListener("message", onMessage);
      reject(error);
    }
  }), params.timeoutMs, "Relay subscribe probe timeout");
};

const probeNip11 = async (params) => {
  const startedAt = nowUnixMs();
  try {
    const response = await withTimeout(
      params.fetchImpl(toHttpRelayUrl(params.relayUrl), {
        method: "GET",
        headers: { Accept: "application/nostr+json, application/json" },
      }),
      params.timeoutMs,
      "NIP-11 fetch timeout"
    );
    if (!response.ok) {
      return createResult({
        target: params.relayUrl,
        check: "nip11_fetch",
        status: "failed",
        reasonCode: "nip11_http_error",
        retryable: response.status >= 500,
        latencyMs: nowUnixMs() - startedAt,
        message: `HTTP ${response.status}`,
      });
    }
    try {
      await response.json();
      return createResult({
        target: params.relayUrl,
        check: "nip11_fetch",
        status: "ok",
        retryable: false,
        latencyMs: nowUnixMs() - startedAt,
      });
    } catch {
      return createResult({
        target: params.relayUrl,
        check: "nip11_fetch",
        status: "failed",
        reasonCode: "nip11_invalid_json",
        retryable: false,
        latencyMs: nowUnixMs() - startedAt,
        message: "NIP-11 response is not valid JSON.",
      });
    }
  } catch (error) {
    const classified = classifyFetchError(error);
    return createResult({
      target: params.relayUrl,
      check: "nip11_fetch",
      status: "failed",
      reasonCode: classified.reasonCode,
      retryable: classified.retryable,
      latencyMs: nowUnixMs() - startedAt,
      message: classified.message,
    });
  }
};

const probeNip96 = async (params) => {
  const startedAt = nowUnixMs();
  const providerUrl = params.providerUrl;
  let origin;
  try {
    origin = new URL(providerUrl).origin;
  } catch {
    return [
      createResult({
        target: providerUrl,
        check: "nip96_discovery",
        status: "failed",
        reasonCode: "invalid_url",
        retryable: false,
        latencyMs: nowUnixMs() - startedAt,
        message: "Invalid provider URL.",
      }),
    ];
  }

  const discoveryUrl = `${origin}/.well-known/nostr/nip96.json`;
  const results = [];
  let apiEndpoint = providerUrl;

  try {
    const discoveryResponse = await withTimeout(
      params.fetchImpl(discoveryUrl, { method: "GET", headers: { Accept: "application/json" } }),
      params.timeoutMs,
      "NIP-96 discovery timeout"
    );
    if (!discoveryResponse.ok) {
      results.push(createResult({
        target: providerUrl,
        check: "nip96_discovery",
        status: "failed",
        reasonCode: discoveryResponse.status === 404 ? "nip96_discovery_missing" : "nip96_discovery_http_error",
        retryable: discoveryResponse.status >= 500,
        latencyMs: nowUnixMs() - startedAt,
        message: `HTTP ${discoveryResponse.status}`,
      }));
      return results;
    }
    const discoveryJson = await discoveryResponse.json().catch(() => ({}));
    if (discoveryJson && typeof discoveryJson.api_url === "string" && discoveryJson.api_url.trim().length > 0) {
      apiEndpoint = discoveryJson.api_url;
    } else if (discoveryJson && typeof discoveryJson.apiUrl === "string" && discoveryJson.apiUrl.trim().length > 0) {
      apiEndpoint = discoveryJson.apiUrl;
    }
    results.push(createResult({
      target: providerUrl,
      check: "nip96_discovery",
      status: "ok",
      retryable: false,
      latencyMs: nowUnixMs() - startedAt,
      message: apiEndpoint,
    }));
  } catch (error) {
    const classified = classifyFetchError(error);
    results.push(createResult({
      target: providerUrl,
      check: "nip96_discovery",
      status: "failed",
      reasonCode: classified.reasonCode,
      retryable: classified.retryable,
      latencyMs: nowUnixMs() - startedAt,
      message: classified.message,
    }));
    return results;
  }

  const authProbeStart = nowUnixMs();
  try {
    const authResponse = await withTimeout(
      params.fetchImpl(apiEndpoint, { method: "GET", headers: { Accept: "application/json" } }),
      params.timeoutMs,
      "NIP-96 auth precheck timeout"
    );
    if (authResponse.status === 401 || authResponse.status === 403) {
      results.push(createResult({
        target: providerUrl,
        check: "nip96_auth_precheck",
        status: "degraded",
        reasonCode: "nip96_auth_required",
        retryable: false,
        latencyMs: nowUnixMs() - authProbeStart,
        message: `HTTP ${authResponse.status}`,
      }));
      return results;
    }
    if (!authResponse.ok) {
      results.push(createResult({
        target: providerUrl,
        check: "nip96_auth_precheck",
        status: "failed",
        reasonCode: "nip96_http_error",
        retryable: authResponse.status >= 500,
        latencyMs: nowUnixMs() - authProbeStart,
        message: `HTTP ${authResponse.status}`,
      }));
      return results;
    }
    results.push(createResult({
      target: providerUrl,
      check: "nip96_auth_precheck",
      status: "ok",
      retryable: false,
      latencyMs: nowUnixMs() - authProbeStart,
    }));
  } catch (error) {
    const classified = classifyFetchError(error);
    results.push(createResult({
      target: providerUrl,
      check: "nip96_auth_precheck",
      status: "failed",
      reasonCode: classified.reasonCode,
      retryable: classified.retryable,
      latencyMs: nowUnixMs() - authProbeStart,
      message: classified.message,
    }));
  }
  return results;
};

/**
 * @param {RelayNipProbeParams} params
 * @returns {Promise<ReadonlyArray<RelayNipProbeResult>>}
 */
export const runRelayNipProbe = async (params) => {
  const relayUrls = normalizeRelayUrls(params.relayUrls || []);
  const nip96Urls = normalizeNip96Urls(params.nip96Urls || []);
  const timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetchImpl = params.fetchImpl ?? globalThis.fetch?.bind(globalThis);
  const webSocketFactory = params.webSocketFactory ?? ((url) => new WebSocket(url));

  /** @type {RelayNipProbeResult[]} */
  const results = [];

  if (typeof webSocketFactory !== "function") {
    relayUrls.forEach((relayUrl) => {
      results.push(createResult({
        target: relayUrl,
        check: "relay_socket",
        status: "unsupported",
        reasonCode: "websocket_unavailable",
        retryable: false,
      }));
    });
  } else {
    for (const relayUrl of relayUrls) {
      let ws = null;
      try {
        const socketResult = await openRelaySocket({
          url: relayUrl,
          timeoutMs,
          webSocketFactory,
        });
        ws = socketResult.ws;
        results.push(createResult({
          target: relayUrl,
          check: "relay_socket",
          status: "ok",
          retryable: false,
          latencyMs: socketResult.latencyMs,
        }));
      } catch (error) {
        results.push(createResult({
          target: relayUrl,
          check: "relay_socket",
          status: "failed",
          reasonCode: error instanceof Error && /timeout/i.test(error.message) ? "timeout" : "ws_open_failed",
          retryable: true,
          message: error instanceof Error ? error.message : String(error),
        }));
        results.push(await probeNip11({ relayUrl, fetchImpl, timeoutMs }));
        continue;
      }

      try {
        const publishResult = await probeRelayPublish({ ws, timeoutMs });
        results.push(createResult({
          target: relayUrl,
          check: "relay_publish",
          status: publishResult.ok ? "ok" : "degraded",
          reasonCode: publishResult.reasonCode,
          retryable: false,
          latencyMs: publishResult.latencyMs,
          message: publishResult.message,
        }));
      } catch (error) {
        results.push(createResult({
          target: relayUrl,
          check: "relay_publish",
          status: "failed",
          reasonCode: error instanceof Error && /timeout/i.test(error.message) ? "timeout" : "publish_probe_failed",
          retryable: true,
          message: error instanceof Error ? error.message : String(error),
        }));
      }

      try {
        const subscribeResult = await probeRelaySubscribe({ ws, timeoutMs });
        results.push(createResult({
          target: relayUrl,
          check: "relay_subscribe",
          status: "ok",
          retryable: false,
          latencyMs: subscribeResult.latencyMs,
        }));
      } catch (error) {
        results.push(createResult({
          target: relayUrl,
          check: "relay_subscribe",
          status: "failed",
          reasonCode: error instanceof Error && /timeout/i.test(error.message) ? "timeout" : "subscribe_probe_failed",
          retryable: true,
          message: error instanceof Error ? error.message : String(error),
        }));
      } finally {
        try {
          ws?.close?.();
        } catch {
          // Ignore close errors.
        }
      }

      results.push(await probeNip11({ relayUrl, fetchImpl, timeoutMs }));
    }
  }

  if (typeof fetchImpl !== "function") {
    nip96Urls.forEach((providerUrl) => {
      results.push(createResult({
        target: providerUrl,
        check: "nip96_discovery",
        status: "unsupported",
        reasonCode: "fetch_unavailable",
        retryable: false,
      }));
    });
    return results;
  }

  for (const providerUrl of nip96Urls) {
    const providerResults = await probeNip96({
      providerUrl,
      fetchImpl,
      timeoutMs,
    });
    results.push(...providerResults);
  }

  return results;
};

/**
 * @param {ReadonlyArray<RelayNipProbeResult>} results
 */
export const summarizeRelayNipProbeResults = (results) => {
  const summary = {
    ok: 0,
    degraded: 0,
    failed: 0,
    unsupported: 0,
  };
  results.forEach((entry) => {
    if (entry.status === "ok") summary.ok += 1;
    else if (entry.status === "degraded") summary.degraded += 1;
    else if (entry.status === "failed") summary.failed += 1;
    else summary.unsupported += 1;
  });
  return summary;
};
