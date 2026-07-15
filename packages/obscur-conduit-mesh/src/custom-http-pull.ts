import type {
  CustomConduitPullItem,
  CustomConduitPullResponse,
  MeshAudience,
  MeshEnvelope,
  MeshInterest,
} from "@obscur/conduit-mesh-contracts";
import {
  CUSTOM_CONDUIT_HTTP_PATHS,
  CUSTOM_CONDUIT_HTTP_V1,
} from "@obscur/conduit-mesh-contracts";

import type { ConduitMeshFetch } from "./conduit-http-utils";
import { decodeCiphertextBase64, normalizeConduitBaseUrl } from "./conduit-http-utils";
import { parseMeshHttpSseBuffer } from "./mesh-http-sse";

export type PullHttpMeshEnvelopesParams = Readonly<{
  baseUrl: string;
  fetch: ConduitMeshFetch;
  cursor?: string;
  /** Request gateway-side DM audience filter (avoids presence broadcast drown). */
  recipientPublicKeyHex?: string;
}>;

export type LongPollHttpMeshEnvelopesParams = PullHttpMeshEnvelopesParams & Readonly<{
  timeoutMs?: number;
  signal?: AbortSignal;
}>;

export const pullHttpMeshEnvelopes = async (
  params: PullHttpMeshEnvelopesParams,
): Promise<CustomConduitPullResponse> => {
  const base = normalizeConduitBaseUrl(params.baseUrl);
  const url = new URL(`${base}${CUSTOM_CONDUIT_HTTP_PATHS.pull}`);
  if (params.cursor) {
    url.searchParams.set("cursor", params.cursor);
  }
  if (params.recipientPublicKeyHex?.trim()) {
    url.searchParams.set("recipientPublicKeyHex", params.recipientPublicKeyHex.trim().toLowerCase());
  }

  const response = await params.fetch(url.toString(), { method: "GET" });
  if (!response.ok) {
    return { items: [] };
  }

  try {
    return await response.json() as CustomConduitPullResponse;
  } catch {
    return { items: [] };
  }
};

/** C12 long-poll: GET /mesh/v1/stream — same item shape as pull. */
export const longPollHttpMeshEnvelopes = async (
  params: LongPollHttpMeshEnvelopesParams,
): Promise<CustomConduitPullResponse> => {
  const base = normalizeConduitBaseUrl(params.baseUrl);
  const url = new URL(`${base}${CUSTOM_CONDUIT_HTTP_PATHS.stream}`);
  if (params.cursor) {
    url.searchParams.set("cursor", params.cursor);
  }
  if (params.recipientPublicKeyHex?.trim()) {
    url.searchParams.set("recipientPublicKeyHex", params.recipientPublicKeyHex.trim().toLowerCase());
  }
  url.searchParams.set("timeoutMs", String(params.timeoutMs ?? 25_000));

  const response = await params.fetch(url.toString(), {
    method: "GET",
    signal: params.signal,
  });
  if (!response.ok) {
    return { items: [] };
  }

  try {
    return await response.json() as CustomConduitPullResponse;
  } catch {
    return { items: [] };
  }
};

export type OpenSseHttpMeshEnvelopeSessionParams = LongPollHttpMeshEnvelopesParams & Readonly<{
  onItem: (item: CustomConduitPullItem, cursor?: string) => void;
}>;

/** C14 SSE: open lasting GET /mesh/v1/stream with Accept: text/event-stream. */
export const openSseHttpMeshEnvelopeSession = async (
  params: OpenSseHttpMeshEnvelopeSessionParams,
): Promise<void> => {
  const base = normalizeConduitBaseUrl(params.baseUrl);
  const url = new URL(`${base}${CUSTOM_CONDUIT_HTTP_PATHS.stream}`);
  if (params.cursor) {
    url.searchParams.set("cursor", params.cursor);
  }
  if (params.recipientPublicKeyHex?.trim()) {
    url.searchParams.set("recipientPublicKeyHex", params.recipientPublicKeyHex.trim().toLowerCase());
  }

  const headers: Record<string, string> = {
    accept: "text/event-stream",
  };
  if (params.cursor) {
    headers["last-event-id"] = params.cursor;
  }

  const response = await params.fetch(url.toString(), {
    method: "GET",
    headers,
    signal: params.signal,
  });
  if (!response.ok || !response.body) {
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (!params.signal?.aborted) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const parsed = parseMeshHttpSseBuffer(buffer);
      buffer = parsed.remainder;
      for (let i = 0; i < parsed.items.length; i += 1) {
        params.onItem(parsed.items[i]!, parsed.cursors[i]);
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // ignore
    }
  }
};

export const pullItemToMeshEnvelope = (
  item: CustomConduitPullItem,
  scopeProfileId: string,
): MeshEnvelope => ({
  envelopeId: item.envelopeId,
  scope: { profileId: scopeProfileId },
  messageScope: item.messageScope,
  audience: item.audience as MeshAudience,
  ciphertext: decodeCiphertextBase64(item.ciphertextBase64),
  evidenceClass: "at_least_one_conduit_accept",
  createdAtUnixMs: item.createdAtUnixMs,
});

const audienceMatchesInterest = (
  audience: MeshAudience,
  interest: MeshInterest,
  itemMessageScope: CustomConduitPullItem["messageScope"],
): boolean => {
  if (interest.messageScope !== itemMessageScope) {
    return false;
  }

  if (interest.audience.kind === "dm" && audience.kind === "dm") {
    return interest.audience.recipientPublicKeyHex === audience.recipientPublicKeyHex;
  }

  if (interest.audience.kind === "workspace" && audience.kind === "workspace") {
    return interest.audience.communityId === audience.communityId;
  }

  if (interest.audience.kind === "control" && audience.kind === "control") {
    return interest.audience.coordinationTopic === audience.coordinationTopic;
  }

  return interest.messageScope === itemMessageScope;
};

export const pullItemMatchesInterests = (
  item: CustomConduitPullItem,
  interests: ReadonlyArray<MeshInterest>,
): boolean => {
  if (interests.length === 0) {
    return true;
  }

  const audience = item.audience as MeshAudience;
  return interests.some((interest) => audienceMatchesInterest(audience, interest, item.messageScope));
};

export const isCustomHttpPullCapable = (dialect: string): boolean => (
  dialect === "team_relay" || dialect === "custom"
);

export const CUSTOM_HTTP_PULL_CONTRACT = CUSTOM_CONDUIT_HTTP_V1;
