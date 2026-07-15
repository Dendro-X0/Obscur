import type { ConduitSocksFetch } from "@obscur/conduit-mesh";

import { invokeNativeCommand } from "@/app/features/runtime/native-adapters";

export type MeshHttpFetchViaSocksResponse = Readonly<{
  status: number;
  bodyText: string;
  contentType?: string | null;
}>;

export type ConduitMeshSocksFetchHostPort = Readonly<{
  socksFetch: ConduitSocksFetch;
}>;

const headersToRecord = (
  headers: HeadersInit | undefined,
): Record<string, string> | undefined => {
  if (!headers) {
    return undefined;
  }
  const record: Record<string, string> = {};
  const normalized = new Headers(headers);
  normalized.forEach((value, key) => {
    record[key] = value;
  });
  return Object.keys(record).length > 0 ? record : undefined;
};

/**
 * Desktop host port — routes HTTP mesh traffic through Tor SOCKS (C13).
 * PWA / non-native: returns socks_unavailable (callers use clearnet conduits only).
 */
export const createConduitMeshSocksFetchHostPort = (
  invoke: typeof invokeNativeCommand = invokeNativeCommand,
): ConduitMeshSocksFetchHostPort => ({
  socksFetch: async (proxyUrl, input, init) => {
    const method = (init?.method ?? "GET").toUpperCase();
    const result = await invoke<MeshHttpFetchViaSocksResponse>("mesh_http_fetch_via_socks", {
      url: String(input),
      method,
      proxyUrl,
      headers: headersToRecord(init?.headers),
      bodyText: typeof init?.body === "string" ? init.body : undefined,
    });

    if (!result.ok) {
      return new Response(JSON.stringify({ error: result.message ?? "socks_invoke_failed" }), {
        status: 503,
        headers: {
          "content-type": "application/json",
          "x-obscur-fetch-route": "socks_unavailable",
        },
      });
    }

    const headers = new Headers();
    if (result.value.contentType) {
      headers.set("content-type", result.value.contentType);
    }
    headers.set("x-obscur-fetch-route", "socks");
    headers.set("x-obscur-proxy-url", proxyUrl);
    return new Response(result.value.bodyText, {
      status: result.value.status,
      headers,
    });
  },
});
