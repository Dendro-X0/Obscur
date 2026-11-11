/**
 * P4b — minimal private DC HTTPS JSON client (fetch only).
 * Cut 0.6 — H-dc v0.1 ciphertext + poll (`envelope` / `since`) alongside v0 plaintext lab path.
 * @see specs/backend/platform-p4b-private-dc-http-wire-design-2026-11.md
 * @see specs/backend/cut0-account-spine-design-2026-11-09.md §7
 */

import type { CanonicalConversation, CanonicalMessage } from "./types";
import type { PrivateDcSession } from "./private-dc-session";

export const PRIVATE_DC_HTTP_ERROR = "private_dc_http";
export const PRIVATE_DC_WIRE_V01 = "hdc-v0.1";

/** Home ACK status — never map home OK → delivered (Cut 0 status law). */
export type PrivateDcHomeAckStatus =
  | "sending"
  | "queued"
  | "accepted"
  | "rejected"
  | "failed";

export type PrivateDcCipherEnvelope = Readonly<{
  id: string;
  conversationId: string;
  /** Opaque ciphertext blob — home must not require plaintext body. */
  envelope: string;
  clientMessageId?: string;
  sentAtUnixMs: number;
  direction: "in" | "out";
  status: PrivateDcHomeAckStatus;
}>;

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

const normalizeHomeAckStatus = (value: unknown): PrivateDcHomeAckStatus => {
  if (
    value === "sending"
    || value === "queued"
    || value === "accepted"
    || value === "rejected"
    || value === "failed"
  ) {
    return value;
  }
  // Home 2xx ACK → accepted only (never delivered).
  if (value === "sent" || value === "delivered") {
    return "accepted";
  }
  return "accepted";
};

export const normalizeCipherEnvelope = (
  raw: unknown,
  fallbackConversationId?: string,
): PrivateDcCipherEnvelope | null => {
  if (!isRecord(raw)) {
    return null;
  }
  const id = asString(raw.id);
  const conversationId = asString(raw.conversationId) ?? fallbackConversationId ?? null;
  const envelope = asString(raw.envelope);
  const sentAtUnixMs = asNumber(raw.sentAtUnixMs) ?? Date.now();
  if (!id || !conversationId || envelope === null) {
    // Plaintext-only v0 rows (body, no envelope) are not T3 receive.
    return null;
  }
  const clientMessageId = asString(raw.clientMessageId) ?? undefined;
  return {
    id,
    conversationId,
    envelope,
    clientMessageId,
    sentAtUnixMs,
    direction: normalizeDirection(raw.direction),
    status: normalizeHomeAckStatus(raw.status),
  };
};

/** Cut 0.6 — liveness probe. */
export const privateDcHealth = async (
  session: PrivateDcSession,
  fetchImpl: typeof fetch = fetch,
): Promise<Readonly<{ ok: boolean; wire?: string }>> => {
  const body = await privateDcFetch(session, "/v1/health", { method: "GET" }, fetchImpl);
  const ok = body.ok === true || body.status === "ok";
  if (!ok) {
    throw new Error(`${PRIVATE_DC_HTTP_ERROR}_health_unhealthy`);
  }
  const wire = asString(body.wire) ?? undefined;
  return { ok: true, wire };
};

/**
 * Cut 0.6 — poll ciphertext envelopes (`?since=` unix ms).
 * Rows without `envelope` are dropped (plaintext v0 bodies are not T3 receive).
 */
export const privateDcListMessageEnvelopes = async (
  session: PrivateDcSession,
  params: Readonly<{ conversationId: string; since?: number; limit?: number }>,
  fetchImpl: typeof fetch = fetch,
): Promise<ReadonlyArray<PrivateDcCipherEnvelope>> => {
  const id = encodeURIComponent(params.conversationId.trim());
  const query = new URLSearchParams();
  if (typeof params.since === "number" && Number.isFinite(params.since) && params.since > 0) {
    query.set("since", String(Math.floor(params.since)));
  }
  if (typeof params.limit === "number" && params.limit > 0) {
    query.set("limit", String(Math.floor(params.limit)));
  }
  const qs = query.toString();
  const body = await privateDcFetch(
    session,
    `/v1/conversations/${id}/messages${qs ? `?${qs}` : ""}`,
    { method: "GET" },
    fetchImpl,
  );
  const rows = Array.isArray(body.messages) ? body.messages : [];
  return rows
    .map((row) => normalizeCipherEnvelope(row, params.conversationId))
    .filter((row): row is PrivateDcCipherEnvelope => row !== null);
};

/**
 * Cut 0.6 — POST opaque envelope. Rejects plaintext `body` on this path.
 * Home ACK status is `accepted` (never `delivered`).
 */
export const privateDcSendEnvelope = async (
  session: PrivateDcSession,
  params: Readonly<{
    conversationId: string;
    envelope: string;
    clientMessageId: string;
  }>,
  fetchImpl: typeof fetch = fetch,
): Promise<PrivateDcCipherEnvelope> => {
  const envelope = params.envelope.trim();
  const clientMessageId = params.clientMessageId.trim();
  if (!envelope) {
    throw new Error(`${PRIVATE_DC_HTTP_ERROR}_envelope_required`);
  }
  if (!clientMessageId) {
    throw new Error(`${PRIVATE_DC_HTTP_ERROR}_client_message_id_required`);
  }
  const id = encodeURIComponent(params.conversationId.trim());
  const response = await privateDcFetch(
    session,
    `/v1/conversations/${id}/messages`,
    {
      method: "POST",
      body: JSON.stringify({
        envelope,
        clientMessageId,
      }),
    },
    fetchImpl,
  );
  // Reject servers that echo plaintext body as the only payload (v0-only homes).
  if (isRecord(response.message) && asString(response.message.body) && !asString(response.message.envelope)) {
    throw new Error(`${PRIVATE_DC_HTTP_ERROR}_plaintext_rejected`);
  }
  const message = normalizeCipherEnvelope(response.message, params.conversationId);
  if (!message) {
    // Some homes ACK with top-level id + envelope
    const ack = normalizeCipherEnvelope(
      {
        id: response.id ?? response.homeMessageId,
        conversationId: params.conversationId,
        envelope: response.envelope ?? envelope,
        clientMessageId,
        sentAtUnixMs: response.sentAtUnixMs ?? Date.now(),
        direction: "out",
        status: response.status ?? "accepted",
      },
      params.conversationId,
    );
    if (!ack) {
      throw new Error(`${PRIVATE_DC_HTTP_ERROR}_malformed_envelope`);
    }
    return ack;
  }
  return message;
};
