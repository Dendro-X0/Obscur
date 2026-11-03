/**
 * P4b — minimal private DC HTTPS JSON client (fetch only).
 * @see specs/backend/platform-p4b-private-dc-http-wire-design-2026-11.md
 */

import type { CanonicalConversation, CanonicalMessage } from "./types";
import type { PrivateDcSession } from "./private-dc-session";

export const PRIVATE_DC_HTTP_ERROR = "private_dc_http";

type PrivateDcJson = Record<string, unknown>;

const normalizeBaseUrl = (url: string): string => url.trim().replace(/\/+$/, "");

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === "object" && value !== null && !Array.isArray(value)
);

const asString = (value: unknown): string | null => (
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null
);

const asNumber = (value: unknown): number | null => (
  typeof value === "number" && Number.isFinite(value) ? value : null
);

const normalizeDirection = (value: unknown): CanonicalMessage["direction"] => (
  value === "in" || value === "out" ? value : "out"
);

const normalizeStatus = (value: unknown): CanonicalMessage["status"] => {
  if (value === "sending" || value === "sent" || value === "failed" || value === "delivered") {
    return value;
  }
  return "sent";
};

export const normalizeCanonicalConversation = (raw: unknown): CanonicalConversation | null => {
  if (!isRecord(raw)) {
    return null;
  }
  const id = asString(raw.id);
  const title = asString(raw.title);
  if (!id || !title) {
    return null;
  }
  return { id, title };
};

export const normalizeCanonicalMessage = (
  raw: unknown,
  fallbackConversationId?: string,
): CanonicalMessage | null => {
  if (!isRecord(raw)) {
    return null;
  }
  const id = asString(raw.id);
  const conversationId = asString(raw.conversationId) ?? fallbackConversationId ?? null;
  const body = asString(raw.body);
  const sentAtUnixMs = asNumber(raw.sentAtUnixMs) ?? Date.now();
  if (!id || !conversationId || body === null) {
    return null;
  }
  return {
    id,
    conversationId,
    body,
    sentAtUnixMs,
    direction: normalizeDirection(raw.direction),
    status: normalizeStatus(raw.status),
  };
};

const privateDcFetch = async (
  session: PrivateDcSession,
  path: string,
  init: RequestInit,
  fetchImpl: typeof fetch,
): Promise<PrivateDcJson> => {
  const base = normalizeBaseUrl(session.baseUrl);
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  if (session.bearerToken) {
    headers.set("Authorization", `Bearer ${session.bearerToken}`);
  }
  const response = await fetchImpl(`${base}${path}`, {
    ...init,
    headers,
  });
  const text = await response.text();
  let body: PrivateDcJson = {};
  if (text) {
    try {
      body = JSON.parse(text) as PrivateDcJson;
    } catch {
      throw new Error(`${PRIVATE_DC_HTTP_ERROR}_invalid_json: ${response.status}`);
    }
  }
  if (!response.ok) {
    const detail = asString(body.error) ?? asString(body.message) ?? response.statusText;
    throw new Error(`${PRIVATE_DC_HTTP_ERROR}_${response.status}: ${detail}`);
  }
  return body;
};

export const privateDcListConversations = async (
  session: PrivateDcSession,
  fetchImpl: typeof fetch = fetch,
): Promise<ReadonlyArray<CanonicalConversation>> => {
  const body = await privateDcFetch(session, "/v1/conversations", { method: "GET" }, fetchImpl);
  const rows = Array.isArray(body.conversations) ? body.conversations : [];
  return rows
    .map((row) => normalizeCanonicalConversation(row))
    .filter((row): row is CanonicalConversation => row !== null);
};

export const privateDcListMessages = async (
  session: PrivateDcSession,
  params: Readonly<{ conversationId: string; limit?: number }>,
  fetchImpl: typeof fetch = fetch,
): Promise<ReadonlyArray<CanonicalMessage>> => {
  const id = encodeURIComponent(params.conversationId.trim());
  const query = typeof params.limit === "number" && params.limit > 0
    ? `?limit=${Math.floor(params.limit)}`
    : "";
  const body = await privateDcFetch(
    session,
    `/v1/conversations/${id}/messages${query}`,
    { method: "GET" },
    fetchImpl,
  );
  const rows = Array.isArray(body.messages) ? body.messages : [];
  return rows
    .map((row) => normalizeCanonicalMessage(row, params.conversationId))
    .filter((row): row is CanonicalMessage => row !== null);
};

export const privateDcSendMessage = async (
  session: PrivateDcSession,
  params: Readonly<{ conversationId: string; body: string }>,
  fetchImpl: typeof fetch = fetch,
): Promise<CanonicalMessage> => {
  const id = encodeURIComponent(params.conversationId.trim());
  const response = await privateDcFetch(
    session,
    `/v1/conversations/${id}/messages`,
    {
      method: "POST",
      body: JSON.stringify({ body: params.body }),
    },
    fetchImpl,
  );
  const message = normalizeCanonicalMessage(response.message, params.conversationId);
  if (!message) {
    throw new Error(`${PRIVATE_DC_HTTP_ERROR}_malformed_message`);
  }
  return message;
};
