import { createServer, type Server, type ServerResponse } from "node:http";
import { Readable } from "node:stream";

import {
  createMeshHttpGatewayFetch,
  createMeshHttpGatewayStore,
  handleMeshHttpGatewayRequest,
  handleMeshHttpGatewayStreamRequest,
  type MeshHttpGatewayStore,
} from "@obscur/conduit-mesh";
import { CUSTOM_CONDUIT_HTTP_PATHS } from "@obscur/conduit-mesh-contracts";

export type StartMeshHttpGatewayServerParams = Readonly<{
  port: number;
  host?: string;
  store?: MeshHttpGatewayStore;
}>;

export const startMeshHttpGatewayServer = (
  params: StartMeshHttpGatewayServerParams,
): Server => {
  const store = params.store ?? createMeshHttpGatewayStore();
  const host = params.host ?? "127.0.0.1";
  const gatewayFetch = createMeshHttpGatewayFetch(store, `http://${host}:${params.port}`);

  const writeCorsHeaders = (res: ServerResponse): void => {
    // Local reference gateway: desktop/PWA origins (e.g. http://127.0.0.1:1430) call pull/publish via fetch.
    res.setHeader("access-control-allow-origin", "*");
    res.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
    res.setHeader(
      "access-control-allow-headers",
      "content-type, authorization, accept, last-event-id",
    );
  };

  const server = createServer((req, res) => {
    writeCorsHeaders(res);

    if ((req.method ?? "GET").toUpperCase() === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return;
    }

    const url = new URL(req.url ?? "/", `http://${host}:${params.port}`);
    const chunks: Buffer[] = [];

    req.on("data", (chunk) => {
      chunks.push(Buffer.from(chunk));
    });

    req.on("end", () => {
      void (async () => {
        const bodyText = chunks.length > 0 ? Buffer.concat(chunks).toString("utf8") : undefined;
        const pathname = url.pathname.replace(/\/$/, "") || "/";
        const isStream = (req.method ?? "GET").toUpperCase() === "GET"
          && pathname === CUSTOM_CONDUIT_HTTP_PATHS.stream;
        const accept = String(req.headers.accept ?? "");
        const wantsSse = accept.toLowerCase().includes("text/event-stream");

        const abort = new AbortController();
        const onClose = (): void => {
          abort.abort();
        };
        req.on("close", onClose);

        try {
          if (isStream && wantsSse) {
            const headers: Record<string, string> = {
              accept,
            };
            if (typeof req.headers["last-event-id"] === "string") {
              headers["last-event-id"] = req.headers["last-event-id"];
            }
            const response = await gatewayFetch(url.toString(), {
              method: "GET",
              headers,
              signal: abort.signal,
            });
            if (res.writableEnded) {
              return;
            }
            res.statusCode = response.status;
            response.headers.forEach((value, key) => {
              res.setHeader(key, value);
            });
            if (response.body) {
              Readable.fromWeb(response.body as import("node:stream/web").ReadableStream).pipe(res);
            } else {
              res.end();
            }
            return;
          }

          const request = {
            method: req.method ?? "GET",
            pathname: url.pathname,
            searchParams: url.searchParams,
            bodyText,
          };

          const response = isStream
            ? await handleMeshHttpGatewayStreamRequest(request, store, {
              signal: abort.signal,
            })
            : handleMeshHttpGatewayRequest(request, store);

          if (res.writableEnded) {
            return;
          }
          res.statusCode = response.status;
          if (response.contentType) {
            res.setHeader("content-type", response.contentType);
          }
          res.end(response.body);
        } catch {
          if (!res.writableEnded) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: "stream_handler_failed" }));
          }
        } finally {
          req.off("close", onClose);
        }
      })();
    });
  });

  server.listen(params.port, host, () => {
    console.log(`[Mesh HTTP Gateway] Listening on http://${host}:${params.port}`);
  });

  return server;
};
