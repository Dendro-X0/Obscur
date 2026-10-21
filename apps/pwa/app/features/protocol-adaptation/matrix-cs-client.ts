/**
 * Thin Matrix Client-Server API (C2 MVP) — fetch only, no matrix-js-sdk.
 * Cleartext / server-visible rooms; no Olm-Megolm in this slice.
 */

import { PROTOCOL_ADAPTATION_PERF_BUDGETS } from "./performance-budgets";

export type MatrixLoginParams = Readonly<{
  homeserverUrl: string;
  userId: string;
  password: string;
  fetchImpl?: typeof fetch;
}>;

export type MatrixLoginResult = Readonly<{
  homeserverUrl: string;
  userId: string;
  accessToken: string;
  deviceId?: string;
}>;

export type MatrixRoomSummary = Readonly<{
  roomId: string;
  title: string;
  lastMessagePreview: string;
  lastMessageAtUnixMs: number;
}>;

export type MatrixTimelineMessage = Readonly<{
  eventId: string;
  roomId: string;
  body: string;
  sentAtUnixMs: number;
  senderUserId: string;
}>;

export type MatrixClientSession = Readonly<{
  homeserverUrl: string;
  userId: string;
  accessToken: string;
  deviceId?: string;
}>;

type MatrixJson = Record<string, unknown>;

const normalizeHomeserverUrl = (url: string): string => (
  url.trim().replace(/\/+$/, "")
);

const matrixFetch = async (
  session: MatrixClientSession | { homeserverUrl: string },
  path: string,
  init: RequestInit,
  fetchImpl: typeof fetch,
): Promise<MatrixJson> => {
  const base = normalizeHomeserverUrl(session.homeserverUrl);
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if ("accessToken" in session && session.accessToken) {
    headers.set("Authorization", `Bearer ${session.accessToken}`);
  }
  const response = await fetchImpl(`${base}${path}`, {
    ...init,
    headers,
  });
  const text = await response.text();
  let body: MatrixJson = {};
  if (text) {
    try {
      body = JSON.parse(text) as MatrixJson;
    } catch {
      body = { raw: text };
    }
  }
  if (!response.ok) {
    const errcode = typeof body.errcode === "string" ? body.errcode : "M_UNKNOWN";
    const error = typeof body.error === "string" ? body.error : response.statusText;
    throw new Error(`Matrix ${errcode}: ${error}`);
  }
  return body;
};

/** Password login — returns session fields for persistence. */
export const matrixLoginPassword = async (
  params: MatrixLoginParams,
): Promise<MatrixLoginResult> => {
  const fetchImpl = params.fetchImpl ?? fetch;
  const homeserverUrl = normalizeHomeserverUrl(params.homeserverUrl);
  const body = await matrixFetch(
    { homeserverUrl },
    "/_matrix/client/v3/login",
    {
      method: "POST",
      body: JSON.stringify({
        type: "m.login.password",
        identifier: {
          type: "m.id.user",
          user: params.userId.replace(/^@/, "").split(":")[0] ?? params.userId,
        },
        password: params.password,
        initial_device_display_name: "Obscur",
      }),
    },
    fetchImpl,
  );
  const accessToken = typeof body.access_token === "string" ? body.access_token : "";
  const userId = typeof body.user_id === "string" ? body.user_id : params.userId;
  const deviceId = typeof body.device_id === "string" ? body.device_id : undefined;
  if (!accessToken) {
    throw new Error("Matrix login: missing access_token");
  }
  return {
    homeserverUrl,
    userId,
    accessToken,
    deviceId,
  };
};

/** Validate an existing access token (SSO / Element export). */
export const matrixWhoami = async (
  params: Readonly<{
    homeserverUrl: string;
    accessToken: string;
    fetchImpl?: typeof fetch;
  }>,
): Promise<Readonly<{ userId: string; deviceId?: string }>> => {
  const fetchImpl = params.fetchImpl ?? fetch;
  const homeserverUrl = normalizeHomeserverUrl(params.homeserverUrl);
  const accessToken = params.accessToken.trim();
  if (!accessToken) {
    throw new Error("Matrix whoami: missing access_token");
  }
  const body = await matrixFetch(
    { homeserverUrl, userId: "", accessToken },
    "/_matrix/client/v3/account/whoami",
    { method: "GET" },
    fetchImpl,
  );
  const userId = typeof body.user_id === "string" ? body.user_id : "";
  if (!userId) {
    throw new Error("Matrix whoami: missing user_id");
  }
  return {
    userId,
    deviceId: typeof body.device_id === "string" ? body.device_id : undefined,
  };
};

type JoinedRoomState = {
  name?: string;
  canonicalAlias?: string;
  lastBody?: string;
  lastTs?: number;
};

const collectRoomSummariesFromSync = (syncBody: MatrixJson): MatrixRoomSummary[] => {
  const rooms = syncBody.rooms as MatrixJson | undefined;
  const join = (rooms?.join ?? {}) as Record<string, MatrixJson>;
  const summaries: MatrixRoomSummary[] = [];

  for (const [roomId, room] of Object.entries(join)) {
    const state: JoinedRoomState = {};
    const timelineEvents = (
      ((room.timeline as MatrixJson | undefined)?.events as unknown[]) ?? []
    ) as ReadonlyArray<MatrixJson>;
    const stateEvents = (
      ((room.state as MatrixJson | undefined)?.events as unknown[]) ?? []
    ) as ReadonlyArray<MatrixJson>;

    for (const event of [...stateEvents, ...timelineEvents]) {
      const type = typeof event.type === "string" ? event.type : "";
      const content = (event.content ?? {}) as MatrixJson;
      if (type === "m.room.name" && typeof content.name === "string") {
        state.name = content.name;
      }
      if (type === "m.room.canonical_alias" && typeof content.alias === "string") {
        state.canonicalAlias = content.alias;
      }
      if (type === "m.room.message" && typeof content.body === "string") {
        state.lastBody = content.body;
        state.lastTs = typeof event.origin_server_ts === "number"
          ? event.origin_server_ts
          : state.lastTs;
      }
    }

    summaries.push({
      roomId,
      title: state.name || state.canonicalAlias || roomId,
      lastMessagePreview: state.lastBody ?? "",
      lastMessageAtUnixMs: state.lastTs ?? 0,
    });
  }

  return summaries.sort((a, b) => b.lastMessageAtUnixMs - a.lastMessageAtUnixMs);
};

/** One-shot sync for joined rooms (filter: timeline limited). */
export const matrixSyncRooms = async (
  session: MatrixClientSession,
  options?: Readonly<{ fetchImpl?: typeof fetch; timeoutMs?: number }>,
): Promise<ReadonlyArray<MatrixRoomSummary>> => {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const timeout = options?.timeoutMs ?? 0;
  const filter = encodeURIComponent(JSON.stringify({
    room: {
      timeline: { limit: PROTOCOL_ADAPTATION_PERF_BUDGETS.matrixSyncTimelineLimit },
      state: { lazy_load_members: true },
    },
  }));
  const body = await matrixFetch(
    session,
    `/_matrix/client/v3/sync?timeout=${timeout}&filter=${filter}`,
    { method: "GET" },
    fetchImpl,
  );
  return collectRoomSummariesFromSync(body);
};

export const matrixListRoomMessages = async (
  session: MatrixClientSession,
  roomId: string,
  options?: Readonly<{ limit?: number; fetchImpl?: typeof fetch }>,
): Promise<ReadonlyArray<MatrixTimelineMessage>> => {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const limit = options?.limit ?? PROTOCOL_ADAPTATION_PERF_BUDGETS.matrixRoomMessagesLimit;
  const encodedRoom = encodeURIComponent(roomId);
  const body = await matrixFetch(
    session,
    `/_matrix/client/v3/rooms/${encodedRoom}/messages?dir=b&limit=${limit}`,
    { method: "GET" },
    fetchImpl,
  );
  const chunk = (body.chunk as unknown[] | undefined) ?? [];
  const messages: MatrixTimelineMessage[] = [];
  for (const raw of chunk) {
    const event = raw as MatrixJson;
    if (event.type !== "m.room.message") {
      continue;
    }
    const content = (event.content ?? {}) as MatrixJson;
    if (typeof content.body !== "string") {
      continue;
    }
    const eventId = typeof event.event_id === "string" ? event.event_id : "";
    const sender = typeof event.sender === "string" ? event.sender : "";
    if (!eventId) {
      continue;
    }
    messages.push({
      eventId,
      roomId,
      body: content.body,
      sentAtUnixMs: typeof event.origin_server_ts === "number" ? event.origin_server_ts : 0,
      senderUserId: sender,
    });
  }
  // API returns newest-first with dir=b; present ascending for UI.
  return messages.reverse();
};

export const matrixSendRoomText = async (
  session: MatrixClientSession,
  params: Readonly<{ roomId: string; body: string; txnId?: string; fetchImpl?: typeof fetch }>,
): Promise<Readonly<{ eventId: string }>> => {
  const fetchImpl = params.fetchImpl ?? fetch;
  const txnId = params.txnId ?? `obscur-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const encodedRoom = encodeURIComponent(params.roomId);
  const encodedTxn = encodeURIComponent(txnId);
  const body = await matrixFetch(
    session,
    `/_matrix/client/v3/rooms/${encodedRoom}/send/m.room.message/${encodedTxn}`,
    {
      method: "PUT",
      body: JSON.stringify({
        msgtype: "m.text",
        body: params.body,
      }),
    },
    fetchImpl,
  );
  const eventId = typeof body.event_id === "string" ? body.event_id : "";
  if (!eventId) {
    throw new Error("Matrix send: missing event_id");
  }
  return { eventId };
};

/** Deterministic 64-hex fingerprint for DmConversation.pubkey compatibility. */
export const matrixRoomIdToSyntheticPubkey = (roomId: string): string => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < roomId.length; i += 1) {
    hash ^= roomId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  const hex = (hash >>> 0).toString(16).padStart(8, "0");
  return (hex.repeat(8)).slice(0, 64);
};
