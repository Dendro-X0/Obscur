/**
 * Cut 4.4 — package-facing H-dc home envelope client (fetch only).
 * Vite and Next supply session; neither imports the other's UI tree.
 * Home ACK accepted ≠ delivered.
 */

export const PRIVATE_DC_HOME_HTTP_ERROR = "private_dc_http";

export type PrivateDcHomeSession = Readonly<{
  baseUrl: string;
  bearerToken?: string;
}>;

export type PrivateDcHomeAckStatus =
  | "sending"
  | "queued"
  | "accepted"
  | "rejected"
  | "failed";

export type PrivateDcHomeEnvelopeAck = Readonly<{
  id: string;
  conversationId: string;
  envelope: string;
  clientMessageId?: string;
  sentAtUnixMs: number;
  status: PrivateDcHomeAckStatus;
}>;

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

const normalizeAckStatus = (value: unknown): PrivateDcHomeAckStatus => {
  if (
    value === "sending"
    || value === "queued"
    || value === "accepted"
    || value === "rejected"
    || value === "failed"
  ) {
    return value;
  }
  return "accepted";
};

export const normalizePrivateDcHomeEnvelopeAck = (
  raw: unknown,
  fallbackConversationId: string,
  fallbackEnvelope: string,
  fallbackClientMessageId: string,
): PrivateDcHomeEnvelopeAck | null => {
  if (!isRecord(raw)) {
    return null;
  }
  const id = asString(raw.id) ?? asString(raw.homeMessageId);
  const conversationId = asString(raw.conversationId) ?? fallbackConversationId;
  const envelope = asString(raw.envelope) ?? fallbackEnvelope;
  if (!id || !conversationId || !envelope) {
    return null;
  }
  return {
    id,
    conversationId,
    envelope,
    clientMessageId: asString(raw.clientMessageId) ?? fallbackClientMessageId,
    sentAtUnixMs: asNumber(raw.sentAtUnixMs) ?? Date.now(),
    status: normalizeAckStatus(raw.status),
  };
};

const privateDcHomeFetch = async (
  session: PrivateDcHomeSession,
  path: string,
  init: RequestInit,
  fetchImpl: typeof fetch,
): Promise<Record<string, unknown>> => {
  const base = normalizeBaseUrl(session.baseUrl);
  if (!/^https?:\/\//i.test(base)) {
    throw new Error(`${PRIVATE_DC_HOME_HTTP_ERROR}_invalid_base_url`);
  }
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
  let body: Record<string, unknown> = {};
  if (text) {
    try {
      body = JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new Error(`${PRIVATE_DC_HOME_HTTP_ERROR}_invalid_json: ${response.status}`);
    }
  }
  if (!response.ok) {
    const message = asString(body.error) ?? asString(body.message) ?? response.statusText;
    throw new Error(`${PRIVATE_DC_HOME_HTTP_ERROR}_${response.status}: ${message}`);
  }
  return body;
};

/**
 * POST opaque envelope. Rejects plaintext-only home responses.
 */
export const sendPrivateDcHomeEnvelope = async (
  session: PrivateDcHomeSession,
  params: Readonly<{
    conversationId: string;
    envelope: string;
    clientMessageId: string;
  }>,
  fetchImpl: typeof fetch = fetch,
): Promise<PrivateDcHomeEnvelopeAck> => {
  const envelope = params.envelope.trim();
  const clientMessageId = params.clientMessageId.trim();
  if (!envelope) {
    throw new Error(`${PRIVATE_DC_HOME_HTTP_ERROR}_envelope_required`);
  }
  if (!clientMessageId) {
    throw new Error(`${PRIVATE_DC_HOME_HTTP_ERROR}_client_message_id_required`);
  }
  const id = encodeURIComponent(params.conversationId.trim());
  const response = await privateDcHomeFetch(
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
  if (isRecord(response.message) && asString(response.message.body) && !asString(response.message.envelope)) {
    throw new Error(`${PRIVATE_DC_HOME_HTTP_ERROR}_plaintext_rejected`);
  }
  const fromMessage = normalizePrivateDcHomeEnvelopeAck(
    response.message,
    params.conversationId,
    envelope,
    clientMessageId,
  );
  if (fromMessage) {
    return fromMessage;
  }
  const fromTop = normalizePrivateDcHomeEnvelopeAck(
    {
      id: response.id ?? response.homeMessageId,
      conversationId: params.conversationId,
      envelope: response.envelope ?? envelope,
      clientMessageId,
      sentAtUnixMs: response.sentAtUnixMs ?? Date.now(),
      status: response.status ?? "accepted",
    },
    params.conversationId,
    envelope,
    clientMessageId,
  );
  if (!fromTop) {
    throw new Error(`${PRIVATE_DC_HOME_HTTP_ERROR}_malformed_envelope`);
  }
  return fromTop;
};

/**
 * Cut 9.1 — Continuity M2 opaque backup on private home.
 * Server stores sealed Continuity M1 JSON only — never plaintext.
 * ≠ Continuity Pass · Soft L3 paused.
 */

export type PrivateDcContinuityBackupAck = Readonly<{
  id: string;
  publicKeyHexHint: string;
  acceptedAtUnixMs: number;
  status: "accepted";
}>;

export type PrivateDcContinuityBackupRecord = Readonly<{
  id: string;
  publicKeyHexHint: string;
  sealedEnvelopeJson: string;
  acceptedAtUnixMs: number;
}>;

export const putPrivateDcContinuityBackup = async (
  session: PrivateDcHomeSession,
  params: Readonly<{
    publicKeyHexHint: string;
    sealedEnvelopeJson: string;
    clientBackupId: string;
  }>,
  fetchImpl: typeof fetch = fetch,
): Promise<PrivateDcContinuityBackupAck> => {
  const publicKeyHexHint = params.publicKeyHexHint.trim().toLowerCase();
  const sealedEnvelopeJson = params.sealedEnvelopeJson.trim();
  const clientBackupId = params.clientBackupId.trim();
  if (!publicKeyHexHint) {
    throw new Error(`${PRIVATE_DC_HOME_HTTP_ERROR}_continuity_pubkey_required`);
  }
  if (!sealedEnvelopeJson) {
    throw new Error(`${PRIVATE_DC_HOME_HTTP_ERROR}_continuity_sealed_required`);
  }
  if (!clientBackupId) {
    throw new Error(`${PRIVATE_DC_HOME_HTTP_ERROR}_continuity_client_backup_id_required`);
  }
  const response = await privateDcHomeFetch(
    session,
    "/v1/continuity/backups",
    {
      method: "POST",
      body: JSON.stringify({
        publicKeyHexHint,
        sealedEnvelopeJson,
        clientBackupId,
      }),
    },
    fetchImpl,
  );
  const backup = isRecord(response.backup) ? response.backup : response;
  const id = asString(backup.id);
  const hint = asString(backup.publicKeyHexHint) ?? publicKeyHexHint;
  const acceptedAtUnixMs = asNumber(backup.acceptedAtUnixMs) ?? Date.now();
  if (!id) {
    throw new Error(`${PRIVATE_DC_HOME_HTTP_ERROR}_continuity_malformed_ack`);
  }
  return {
    id,
    publicKeyHexHint: hint,
    acceptedAtUnixMs,
    status: "accepted",
  };
};

export const fetchLatestPrivateDcContinuityBackup = async (
  session: PrivateDcHomeSession,
  params: Readonly<{
    publicKeyHexHint: string;
  }>,
  fetchImpl: typeof fetch = fetch,
): Promise<PrivateDcContinuityBackupRecord | null> => {
  const publicKeyHexHint = params.publicKeyHexHint.trim().toLowerCase();
  if (!publicKeyHexHint) {
    throw new Error(`${PRIVATE_DC_HOME_HTTP_ERROR}_continuity_pubkey_required`);
  }
  const query = `?publicKeyHexHint=${encodeURIComponent(publicKeyHexHint)}`;
  const response = await privateDcHomeFetch(
    session,
    `/v1/continuity/backups/latest${query}`,
    { method: "GET" },
    fetchImpl,
  );
  if (response.backup === null || response.backup === undefined) {
    return null;
  }
  if (!isRecord(response.backup)) {
    throw new Error(`${PRIVATE_DC_HOME_HTTP_ERROR}_continuity_malformed_backup`);
  }
  const id = asString(response.backup.id);
  const sealedEnvelopeJson = asString(response.backup.sealedEnvelopeJson);
  const hint = asString(response.backup.publicKeyHexHint) ?? publicKeyHexHint;
  const acceptedAtUnixMs = asNumber(response.backup.acceptedAtUnixMs) ?? Date.now();
  if (!id || !sealedEnvelopeJson) {
    throw new Error(`${PRIVATE_DC_HOME_HTTP_ERROR}_continuity_malformed_backup`);
  }
  return {
    id,
    publicKeyHexHint: hint,
    sealedEnvelopeJson,
    acceptedAtUnixMs,
  };
};

/**
 * Cut 13.1 — Continuity M6 private-home list helpers (opaque envelopes only).
 * Plaintext rows are dropped + counted — never imported as CRM / Soft L3 invent.
 * ≠ Continuity Pass · Soft L3 paused.
 */

export type PrivateDcHomeConversationSummary = Readonly<{
  id: string;
  title?: string;
}>;

export type PrivateDcHomeCipherEnvelope = Readonly<{
  id: string;
  conversationId: string;
  envelope: string;
  sentAtUnixMs: number;
}>;

export type PrivateDcHomeEnvelopeListResult = Readonly<{
  envelopes: ReadonlyArray<PrivateDcHomeCipherEnvelope>;
  droppedPlaintextCount: number;
}>;

const normalizeHomeConversation = (raw: unknown): PrivateDcHomeConversationSummary | null => {
  if (!isRecord(raw)) {
    return null;
  }
  const id = asString(raw.id);
  if (!id) {
    return null;
  }
  const title = asString(raw.title) ?? undefined;
  return title ? { id, title } : { id };
};

export const listPrivateDcHomeConversations = async (
  session: PrivateDcHomeSession,
  fetchImpl: typeof fetch = fetch,
): Promise<ReadonlyArray<PrivateDcHomeConversationSummary>> => {
  const response = await privateDcHomeFetch(
    session,
    "/v1/conversations",
    { method: "GET" },
    fetchImpl,
  );
  const rows = Array.isArray(response.conversations)
    ? response.conversations
    : Array.isArray(response.items)
      ? response.items
      : [];
  return rows
    .map(normalizeHomeConversation)
    .filter((row): row is PrivateDcHomeConversationSummary => row !== null);
};

export const listPrivateDcHomeMessageEnvelopesDetailed = async (
  session: PrivateDcHomeSession,
  params: Readonly<{
    conversationId: string;
    since?: number;
    limit?: number;
  }>,
  fetchImpl: typeof fetch = fetch,
): Promise<PrivateDcHomeEnvelopeListResult> => {
  const conversationId = params.conversationId.trim();
  if (!conversationId) {
    throw new Error(`${PRIVATE_DC_HOME_HTTP_ERROR}_conversation_id_required`);
  }
  const query = new URLSearchParams();
  if (typeof params.since === "number" && Number.isFinite(params.since)) {
    query.set("since", String(params.since));
  }
  if (typeof params.limit === "number" && Number.isFinite(params.limit)) {
    query.set("limit", String(params.limit));
  }
  const qs = query.toString();
  const path = `/v1/conversations/${encodeURIComponent(conversationId)}/messages${qs ? `?${qs}` : ""}`;
  const response = await privateDcHomeFetch(
    session,
    path,
    { method: "GET" },
    fetchImpl,
  );
  const rows = Array.isArray(response.messages)
    ? response.messages
    : Array.isArray(response.items)
      ? response.items
      : [];
  const envelopes: PrivateDcHomeCipherEnvelope[] = [];
  let droppedPlaintextCount = 0;
  for (const row of rows) {
    if (!isRecord(row)) {
      continue;
    }
    const id = asString(row.id);
    const envelope = asString(row.envelope);
    if (!id || !envelope) {
      if (asString(row.body)) {
        droppedPlaintextCount += 1;
      }
      continue;
    }
    envelopes.push({
      id,
      conversationId: asString(row.conversationId) ?? conversationId,
      envelope,
      sentAtUnixMs: asNumber(row.sentAtUnixMs) ?? 0,
    });
  }
  return { envelopes, droppedPlaintextCount };
};
