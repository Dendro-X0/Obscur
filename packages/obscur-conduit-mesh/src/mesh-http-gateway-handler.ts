import {
  CUSTOM_CONDUIT_HTTP_PATHS,
  CUSTOM_CONDUIT_HTTP_V1,
  CUSTOM_CONDUIT_STREAM_DEFAULT_TIMEOUT_MS,
  CUSTOM_CONDUIT_STREAM_MAX_TIMEOUT_MS,
} from "@obscur/conduit-mesh-contracts";
import type {
  CustomConduitPublishBody,
  CustomConduitPullItem,
  CustomConduitPullResponse,
  CustomConduitPublishResponse,
} from "@obscur/conduit-mesh-contracts";

import {
  createMeshHttpGatewaySseResponse,
  wantsMeshHttpSse,
} from "./mesh-http-sse";

export type MeshHttpGatewayStoredEnvelope = CustomConduitPullItem;

export type MeshHttpGatewayListParams = Readonly<{
  cursor?: string;
  limit?: number;
  /** When set, return only envelopes whose DM audience matches (presence flood safe). */
  recipientPublicKeyHex?: string;
}>;

export type MeshHttpGatewayWaitParams = MeshHttpGatewayListParams & Readonly<{
  timeoutMs: number;
  signal?: AbortSignal;
}>;

export type MeshHttpGatewayStore = Readonly<{
  append: (item: MeshHttpGatewayStoredEnvelope) => void;
  list: (params?: MeshHttpGatewayListParams) => CustomConduitPullResponse;
  /**
   * Long-poll helper (C12): return immediately if list is non-empty; otherwise wait
   * until append, timeout, or abort.
   */
  waitForList: (params: MeshHttpGatewayWaitParams) => Promise<CustomConduitPullResponse>;
  /** Durable append listeners for SSE sessions (C14). */
  subscribeAppend: (listener: () => void) => () => void;
  size: () => number;
}>;

export type MeshHttpGatewayRequest = Readonly<{
  method: string;
  pathname: string;
  searchParams?: URLSearchParams;
  bodyText?: string;
  headers?: Readonly<Record<string, string>>;
}>;

export type MeshHttpGatewayResponse = Readonly<{
  status: number;
  body: string;
  contentType?: string;
}>;

const DEFAULT_PULL_LIMIT = 50;

const normalizeAudienceHex = (value: string | undefined): string => (
  (value ?? "").trim().toLowerCase()
);

const clampStreamTimeoutMs = (raw: string | null): number => {
  if (raw === null || raw === "") {
    return CUSTOM_CONDUIT_STREAM_DEFAULT_TIMEOUT_MS;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return CUSTOM_CONDUIT_STREAM_DEFAULT_TIMEOUT_MS;
  }
  return Math.min(parsed, CUSTOM_CONDUIT_STREAM_MAX_TIMEOUT_MS);
};

export const createMeshHttpGatewayStore = (): MeshHttpGatewayStore => {
  const items: MeshHttpGatewayStoredEnvelope[] = [];
  const waiters = new Set<() => void>();
  const appendListeners = new Set<() => void>();

  const notifyWaiters = (): void => {
    for (const wake of Array.from(waiters)) {
      wake();
    }
    for (const listener of Array.from(appendListeners)) {
      listener();
    }
  };

  const list = (params?: MeshHttpGatewayListParams): CustomConduitPullResponse => {
    const limit = params?.limit ?? DEFAULT_PULL_LIMIT;
    const cursorIndex = params?.cursor
      ? Number.parseInt(params.cursor, 10)
      : 0;
    const start = Number.isFinite(cursorIndex) && cursorIndex >= 0 ? cursorIndex : 0;
    const recipientHex = normalizeAudienceHex(params?.recipientPublicKeyHex);
    const view = recipientHex.length > 0
      ? items.filter((item) => {
        const audience = item.audience as { kind?: string; recipientPublicKeyHex?: string } | undefined;
        return audience?.kind === "dm"
          && normalizeAudienceHex(audience.recipientPublicKeyHex) === recipientHex;
      })
      : items;
    const slice = view.slice(start, start + limit);
    const nextIndex = start + slice.length;
    return {
      items: slice,
      // Always return a cursor so clients can long-poll past the last item (C12).
      // Pre-C12 clients only advance when `cursor` is present — still valid.
      cursor: String(nextIndex),
    };
  };

  return {
    append: (item) => {
      items.push(item);
      notifyWaiters();
    },
    list,
    waitForList: async (params) => {
      const immediate = list(params);
      if (immediate.items.length > 0 || params.timeoutMs <= 0) {
        return immediate;
      }

      return await new Promise<CustomConduitPullResponse>((resolve) => {
        let settled = false;
        const finish = (result: CustomConduitPullResponse): void => {
          if (settled) {
            return;
          }
          settled = true;
          waiters.delete(wake);
          clearTimeout(timer);
          params.signal?.removeEventListener("abort", onAbort);
          resolve(result);
        };

        const wake = (): void => {
          const next = list(params);
          if (next.items.length > 0) {
            finish(next);
          }
        };

        const onAbort = (): void => {
          finish(list(params));
        };

        const timer = setTimeout(() => {
          finish(list(params));
        }, params.timeoutMs);

        waiters.add(wake);
        if (params.signal?.aborted) {
          onAbort();
          return;
        }
        params.signal?.addEventListener("abort", onAbort, { once: true });
      });
    },
    subscribeAppend: (listener) => {
      appendListeners.add(listener);
      return () => {
        appendListeners.delete(listener);
      };
    },
    size: () => items.length,
  };
};

const jsonResponse = (status: number, body: unknown): MeshHttpGatewayResponse => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(body),
});

const parsePublishBody = (bodyText: string | undefined): CustomConduitPublishBody | null => {
  if (!bodyText) {
    return null;
  }
  try {
    const parsed = JSON.parse(bodyText) as CustomConduitPublishBody;
    if (parsed.contractVersion !== CUSTOM_CONDUIT_HTTP_V1) {
      return null;
    }
    if (!parsed.envelopeId || !parsed.ciphertextBase64 || !parsed.messageScope) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const parseListParams = (searchParams: URLSearchParams): MeshHttpGatewayListParams => {
  const cursor = searchParams.get("cursor") ?? undefined;
  const limitRaw = searchParams.get("limit");
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;
  const recipientPublicKeyHex = searchParams.get("recipientPublicKeyHex") ?? undefined;
  return { cursor, limit, recipientPublicKeyHex };
};

export const parseMeshHttpGatewayListParams = parseListParams;

/**
 * Reference handler for CUSTOM_CONDUIT_HTTP_V1 — used by relay-gateway and headless tests.
 * Stream route with timeoutMs>0 returns immediate empty if nothing is ready; use
 * `handleMeshHttpGatewayStreamRequest` for true long-poll waits.
 */
export const handleMeshHttpGatewayRequest = (
  request: MeshHttpGatewayRequest,
  store: MeshHttpGatewayStore,
): MeshHttpGatewayResponse => {
  const method = request.method.toUpperCase();
  const pathname = request.pathname.replace(/\/$/, "") || "/";

  if (method === "GET" && pathname === CUSTOM_CONDUIT_HTTP_PATHS.health) {
    return jsonResponse(200, {
      ok: true,
      contractVersion: CUSTOM_CONDUIT_HTTP_V1,
      operatorLabel: "obscur-mesh-http-gateway-reference",
      capabilities: ["pull", "long_poll", "sse"],
      storedEnvelopeCount: store.size(),
    });
  }

  if (method === "POST" && pathname === CUSTOM_CONDUIT_HTTP_PATHS.publish) {
    const body = parsePublishBody(request.bodyText);
    if (!body) {
      const response: CustomConduitPublishResponse = {
        accepted: false,
        errorMessage: "invalid_publish_body",
      };
      return jsonResponse(400, response);
    }

    store.append({
      envelopeId: body.envelopeId,
      messageScope: body.messageScope,
      audience: body.audience,
      ciphertextBase64: body.ciphertextBase64,
      createdAtUnixMs: body.createdAtUnixMs,
      storedRef: `ref-${body.envelopeId}`,
    });

    const response: CustomConduitPublishResponse = {
      accepted: true,
      storedRef: `ref-${body.envelopeId}`,
    };
    return jsonResponse(200, response);
  }

  if (method === "GET" && pathname === CUSTOM_CONDUIT_HTTP_PATHS.pull) {
    const searchParams = request.searchParams ?? new URLSearchParams();
    const pullResponse = store.list(parseListParams(searchParams));
    return jsonResponse(200, pullResponse);
  }

  if (method === "GET" && pathname === CUSTOM_CONDUIT_HTTP_PATHS.stream) {
    const searchParams = request.searchParams ?? new URLSearchParams();
    const timeoutMs = clampStreamTimeoutMs(searchParams.get("timeoutMs"));
    // Sync path: timeoutMs=0 behaves like pull; otherwise empty if nothing ready yet.
    const pullResponse = store.list(parseListParams(searchParams));
    if (pullResponse.items.length > 0 || timeoutMs <= 0) {
      return jsonResponse(200, pullResponse);
    }
    return jsonResponse(200, { items: [] });
  }

  return jsonResponse(404, { error: "not_found" });
};

/** Async long-poll for GET /mesh/v1/stream (C12). */
export const handleMeshHttpGatewayStreamRequest = async (
  request: MeshHttpGatewayRequest,
  store: MeshHttpGatewayStore,
  options?: Readonly<{ signal?: AbortSignal }>,
): Promise<MeshHttpGatewayResponse> => {
  const method = request.method.toUpperCase();
  const pathname = request.pathname.replace(/\/$/, "") || "/";
  if (method !== "GET" || pathname !== CUSTOM_CONDUIT_HTTP_PATHS.stream) {
    return handleMeshHttpGatewayRequest(request, store);
  }

  const searchParams = request.searchParams ?? new URLSearchParams();
  const timeoutMs = clampStreamTimeoutMs(searchParams.get("timeoutMs"));
  const pullResponse = await store.waitForList({
    ...parseListParams(searchParams),
    timeoutMs,
    signal: options?.signal,
  });
  return jsonResponse(200, pullResponse);
};

/**
 * Headless/test fetch adapter that routes pull/publish via sync handler and
 * stream via async waitForList or SSE (C12/C14).
 */
export const createMeshHttpGatewayFetch = (
  store: MeshHttpGatewayStore,
  baseUrl: string,
): ((input: string | URL | Request, init?: RequestInit) => Promise<Response>) => (
  async (input, init) => {
    const url = new URL(String(input), baseUrl);
    const method = (init?.method ?? "GET").toUpperCase();
    const pathname = url.pathname.replace(/\/$/, "") || "/";
    const headerRecord: Record<string, string> = {};
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => {
        headerRecord[key] = value;
      });
    }
    const request = {
      method,
      pathname,
      searchParams: url.searchParams,
      bodyText: typeof init?.body === "string" ? init.body : undefined,
      headers: headerRecord,
    };

    if (method === "GET" && pathname === CUSTOM_CONDUIT_HTTP_PATHS.stream) {
      if (wantsMeshHttpSse(headerRecord)) {
        const listParams = {
          ...parseListParams(url.searchParams),
          cursor: headerRecord["last-event-id"]
            ?? headerRecord["Last-Event-Id"]
            ?? parseListParams(url.searchParams).cursor,
        };
        return createMeshHttpGatewaySseResponse({
          store,
          listParams,
          signal: init?.signal ?? undefined,
        });
      }
      const response = await handleMeshHttpGatewayStreamRequest(request, store, {
        signal: init?.signal ?? undefined,
      });
      return new Response(response.body, {
        status: response.status,
        headers: response.contentType
          ? { "content-type": response.contentType }
          : undefined,
      });
    }

    const response = handleMeshHttpGatewayRequest(request, store);
    return new Response(response.body, {
      status: response.status,
      headers: response.contentType
        ? { "content-type": response.contentType }
        : undefined,
    });
  }
);
