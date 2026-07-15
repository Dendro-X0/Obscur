import type { CustomConduitPullItem } from "@obscur/conduit-mesh-contracts";

import type {
  MeshHttpGatewayListParams,
  MeshHttpGatewayStore,
} from "./mesh-http-gateway-handler";

const SSE_KEEPALIVE_MS = 15_000;

export const wantsMeshHttpSse = (
  headers: Readonly<Record<string, string>> | Headers | undefined,
): boolean => {
  if (!headers) {
    return false;
  }
  const accept = headers instanceof Headers
    ? headers.get("accept")
    : (headers.accept ?? headers.Accept);
  return typeof accept === "string" && accept.toLowerCase().includes("text/event-stream");
};

export const encodeMeshHttpSseEnvelopeFrame = (
  item: CustomConduitPullItem,
  cursor: string,
): string => (
  `id: ${cursor}\nevent: envelope\ndata: ${JSON.stringify(item)}\n\n`
);

export const encodeMeshHttpSseKeepalive = (): string => ": keepalive\n\n";

export type CreateMeshHttpGatewaySseResponseParams = Readonly<{
  store: MeshHttpGatewayStore;
  listParams: MeshHttpGatewayListParams;
  signal?: AbortSignal;
  keepaliveMs?: number;
}>;

/**
 * Build a streaming SSE Response for GET /mesh/v1/stream (C14).
 */
export const createMeshHttpGatewaySseResponse = (
  params: CreateMeshHttpGatewaySseResponseParams,
): Response => {
  const keepaliveMs = params.keepaliveMs ?? SSE_KEEPALIVE_MS;
  let cursor = params.listParams.cursor;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let keepaliveTimer: ReturnType<typeof setInterval> | undefined;

      const close = (): void => {
        if (closed) {
          return;
        }
        closed = true;
        if (keepaliveTimer) {
          clearInterval(keepaliveTimer);
        }
        unsub();
        params.signal?.removeEventListener("abort", onAbort);
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      const emitBacklog = (): void => {
        if (closed) {
          return;
        }
        const page = params.store.list({
          ...params.listParams,
          cursor,
        });
        const startIndex = cursor ? Number.parseInt(cursor, 10) : 0;
        const base = Number.isFinite(startIndex) && startIndex >= 0 ? startIndex : 0;
        page.items.forEach((item, index) => {
          const itemCursor = String(base + index + 1);
          controller.enqueue(encoder.encode(encodeMeshHttpSseEnvelopeFrame(item, itemCursor)));
        });
        if (page.cursor) {
          cursor = page.cursor;
        }
      };

      const unsub = params.store.subscribeAppend(() => {
        emitBacklog();
      });

      const onAbort = (): void => {
        close();
      };

      emitBacklog();

      keepaliveTimer = setInterval(() => {
        if (closed) {
          return;
        }
        try {
          controller.enqueue(encoder.encode(encodeMeshHttpSseKeepalive()));
        } catch {
          close();
        }
      }, keepaliveMs);

      if (params.signal?.aborted) {
        close();
        return;
      }
      params.signal?.addEventListener("abort", onAbort, { once: true });
    },
    cancel() {
      // ReadableStream cancel — noop; start() abort path owns cleanup.
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    },
  });
};

/** Parse SSE text buffer into envelope items (incremental-safe leftover returned). */
export const parseMeshHttpSseBuffer = (
  buffer: string,
): Readonly<{
  items: ReadonlyArray<CustomConduitPullItem>;
  cursors: ReadonlyArray<string>;
  remainder: string;
}> => {
  const parts = buffer.split("\n\n");
  const remainder = parts.pop() ?? "";
  const items: CustomConduitPullItem[] = [];
  const cursors: string[] = [];

  for (const part of parts) {
    const lines = part.split("\n");
    let eventName = "message";
    let data = "";
    let id: string | undefined;
    for (const line of lines) {
      if (line.startsWith("event:")) {
        eventName = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        data += (data ? "\n" : "") + line.slice(5).trim();
      } else if (line.startsWith("id:")) {
        id = line.slice(3).trim();
      }
    }
    if (eventName !== "envelope" || !data) {
      continue;
    }
    try {
      items.push(JSON.parse(data) as CustomConduitPullItem);
      if (id) {
        cursors.push(id);
      }
    } catch {
      // skip malformed frame
    }
  }

  return { items, cursors, remainder };
};
