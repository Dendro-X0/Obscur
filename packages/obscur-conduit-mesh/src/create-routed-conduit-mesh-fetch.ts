import type {
  ConduitDescriptor,
  MeshTorRuntimeState,
} from "@obscur/conduit-mesh-contracts";

import type { ConduitMeshFetch } from "./conduit-http-utils";
import { resolveConduitHttpTransportMode } from "./resolve-conduit-http-transport";

export type ConduitSocksFetch = (
  proxyUrl: string,
  input: string,
  init?: RequestInit,
) => Promise<Response>;

export type CreateRoutedConduitMeshFetchParams = Readonly<{
  descriptor: ConduitDescriptor;
  getTorState: () => MeshTorRuntimeState | Promise<MeshTorRuntimeState>;
  directFetch: ConduitMeshFetch;
  socksFetch: ConduitSocksFetch;
}>;

/**
 * Per-conduit fetch that routes through Tor SOCKS when policy + readiness require it (C13).
 */
export const createRoutedConduitMeshFetch = (
  params: CreateRoutedConduitMeshFetchParams,
): ConduitMeshFetch => (
  async (input, init) => {
    const torState = await params.getTorState();
    const mode = resolveConduitHttpTransportMode(params.descriptor, torState);

    if (mode === "blocked") {
      return new Response(JSON.stringify({ error: "tor_unreachable" }), {
        status: 503,
        headers: { "content-type": "application/json", "x-obscur-fetch-route": "blocked" },
      });
    }

    if (mode === "socks") {
      const proxyUrl = (torState.proxyUrl ?? "").trim();
      const response = await params.socksFetch(proxyUrl, input, init);
      const headers = new Headers(response.headers);
      if (!headers.has("x-obscur-fetch-route")) {
        headers.set("x-obscur-fetch-route", "socks");
      }
      if (!headers.has("x-obscur-proxy-url")) {
        headers.set("x-obscur-proxy-url", proxyUrl);
      }
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    const response = await params.directFetch(input, init);
    const headers = new Headers(response.headers);
    if (!headers.has("x-obscur-fetch-route")) {
      headers.set("x-obscur-fetch-route", "direct");
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
);
