type Env = Readonly<{
  DB: D1Database;
  ENVIRONMENT: string;
}>;

type JsonValue = null | boolean | number | string | ReadonlyArray<JsonValue> | { [key: string]: JsonValue };

type JsonObject = Readonly<Record<string, JsonValue>>;

type InviteCreateBody = Readonly<{
  inviterPubkey: string;
  relays: ReadonlyArray<string>;
  communityLabel?: string;
  ttlSeconds?: number;
}>;

type InviteRedeemBody = Readonly<{
  token: string;
  redeemerPubkey: string;
}>;

type InviteRow = Readonly<{
  invite_id: string;
  token_hash: string;
  inviter_pubkey: string;
  community_label: string | null;
  relays_json: string;
  created_at_unix_seconds: number;
  expires_at_unix_seconds: number | null;
}>;

type InviteCreateResponse = Readonly<{
  inviteId: string;
  token: string;
  relays: ReadonlyArray<string>;
  expiresAtUnixSeconds: number | null;
}>;

type InviteRedeemResponse = Readonly<{
  inviteId: string;
  inviterPubkey: string;
  communityLabel: string | null;
  relays: ReadonlyArray<string>;
  expiresAtUnixSeconds: number | null;
}>;

const MAX_TTL_SECONDS: number = 60 * 60 * 24 * 14;

const DEFAULT_TTL_SECONDS: number = 60 * 60 * 24 * 3;

const json = (params: Readonly<{ status: number; body: JsonObject; extraHeaders?: Readonly<Record<string, string>> }>): Response => {
  const headers = new Headers({
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
    ...(params.extraHeaders ?? {})
  });
  return new Response(JSON.stringify(params.body), { status: params.status, headers });
};

const badRequest = (message: string): Response => json({ status: 400, body: { ok: false, error: message } });

const notFound = (): Response => json({ status: 404, body: { ok: false, error: "not_found" } });

const nowUnixSeconds = (): number => Math.floor(Date.now() / 1000);

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const isString = (value: unknown): value is string => typeof value === "string";

const parseJsonBody = async (request: Request): Promise<JsonObject | null> => {
  try {
    const parsed: unknown = await request.json();
    if (!isRecord(parsed)) {
      return null;
    }
    return parsed as JsonObject;
  } catch {
    return null;
  }
};

const parseInviteCreateBody = (value: JsonObject): InviteCreateBody | null => {
  const inviterPubkey: unknown = value.inviterPubkey;
  const relays: unknown = value.relays;
  const communityLabel: unknown = value.communityLabel;
  const ttlSeconds: unknown = value.ttlSeconds;
  if (!isString(inviterPubkey) || inviterPubkey.trim().length === 0) {
    return null;
  }
  if (!Array.isArray(relays) || relays.length === 0) {
    return null;
  }
  const normalizedRelays: string[] = relays
    .filter((r: unknown): r is string => isString(r) && r.trim().length > 0)
    .map((r: string): string => r.trim());
  if (normalizedRelays.length === 0) {
    return null;
  }
  const normalizedLabel: string | undefined = isString(communityLabel) && communityLabel.trim().length > 0 ? communityLabel.trim() : undefined;
  const normalizedTtl: number | undefined = typeof ttlSeconds === "number" && Number.isFinite(ttlSeconds) ? ttlSeconds : undefined;
  return {
    inviterPubkey: inviterPubkey.trim(),
    relays: normalizedRelays,
    ...(normalizedLabel !== undefined ? { communityLabel: normalizedLabel } : {}),
    ...(normalizedTtl !== undefined ? { ttlSeconds: normalizedTtl } : {})
  };
};

const parseInviteRedeemBody = (value: JsonObject): InviteRedeemBody | null => {
  const token: unknown = value.token;
  const redeemerPubkey: unknown = value.redeemerPubkey;
  if (!isString(token) || token.trim().length < 16) {
    return null;
  }
  if (!isString(redeemerPubkey) || redeemerPubkey.trim().length === 0) {
    return null;
  }
  return { token: token.trim(), redeemerPubkey: redeemerPubkey.trim() };
};

const bytesToHex = (bytes: ArrayBuffer): string => {
  const view = new Uint8Array(bytes);
  let out = "";
  for (let i = 0; i < view.length; i += 1) {
    out += view[i]!.toString(16).padStart(2, "0");
  }
  return out;
};

const sha256Hex = async (input: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(digest);
};

const randomToken = (): string => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const b64 = btoa(String.fromCharCode(...bytes));
  return b64.replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
};

const parseInviteRow = (row: unknown): InviteRow | null => {
  if (!isRecord(row)) {
    return null;
  }
  const invite_id: unknown = row.invite_id;
  const token_hash: unknown = row.token_hash;
  const inviter_pubkey: unknown = row.inviter_pubkey;
  const community_label: unknown = row.community_label;
  const relays_json: unknown = row.relays_json;
  const created_at_unix_seconds: unknown = row.created_at_unix_seconds;
  const expires_at_unix_seconds: unknown = row.expires_at_unix_seconds;
  if (!isString(invite_id) || !isString(token_hash) || !isString(inviter_pubkey) || !isString(relays_json)) {
    return null;
  }
  if (typeof created_at_unix_seconds !== "number") {
    return null;
  }
  return {
    invite_id,
    token_hash,
    inviter_pubkey,
    community_label: isString(community_label) ? community_label : null,
    relays_json,
    created_at_unix_seconds,
    expires_at_unix_seconds: typeof expires_at_unix_seconds === "number" ? expires_at_unix_seconds : null
  };
};

const isExpired = (row: InviteRow, now: number): boolean => {
  if (!row.expires_at_unix_seconds) {
    return false;
  }
  return now >= row.expires_at_unix_seconds;
};

const handleInviteCreate = async (request: Request, env: Env): Promise<Response> => {
  const body: JsonObject | null = await parseJsonBody(request);
  if (!body) {
    return badRequest("invalid_json");
  }
  const parsed: InviteCreateBody | null = parseInviteCreateBody(body);
  if (!parsed) {
    return badRequest("invalid_body");
  }
  const ttl = Math.min(Math.max(parsed.ttlSeconds ?? DEFAULT_TTL_SECONDS, 60), MAX_TTL_SECONDS);
  const now = nowUnixSeconds();
  const expiresAt: number = now + ttl;
  const inviteId: string = crypto.randomUUID();
  const token: string = randomToken();
  const tokenHash: string = await sha256Hex(token);
  const relaysJson: string = JSON.stringify(parsed.relays);
  const result = await env.DB.prepare(
    "INSERT INTO invites (invite_id, token_hash, inviter_pubkey, community_label, relays_json, created_at_unix_seconds, expires_at_unix_seconds) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)"
  )
    .bind(inviteId, tokenHash, parsed.inviterPubkey, parsed.communityLabel ?? null, relaysJson, now, expiresAt)
    .run();
  if (!result.success) {
    return json({ status: 500, body: { ok: false, error: "db_insert_failed" } });
  }
  const response: InviteCreateResponse = {
    inviteId,
    token,
    relays: parsed.relays,
    expiresAtUnixSeconds: expiresAt
  };
  return json({ status: 200, body: { ok: true, data: response } });
};

const handleInviteRedeem = async (request: Request, env: Env): Promise<Response> => {
  const body: JsonObject | null = await parseJsonBody(request);
  if (!body) {
    return badRequest("invalid_json");
  }
  const parsed: InviteRedeemBody | null = parseInviteRedeemBody(body);
  if (!parsed) {
    return badRequest("invalid_body");
  }
  const tokenHash: string = await sha256Hex(parsed.token);
  const raw = await env.DB.prepare("SELECT * FROM invites WHERE token_hash = ?1")
    .bind(tokenHash)
    .first();
  const row: InviteRow | null = parseInviteRow(raw);
  if (!row) {
    return notFound();
  }
  const now = nowUnixSeconds();
  if (isExpired(row, now)) {
    return json({ status: 410, body: { ok: false, error: "expired" } });
  }
  const redemptionId: string = crypto.randomUUID();
  const insert = await env.DB.prepare(
    "INSERT INTO invite_redemptions (redemption_id, invite_id, redeemer_pubkey, redeemed_at_unix_seconds) VALUES (?1, ?2, ?3, ?4)"
  )
    .bind(redemptionId, row.invite_id, parsed.redeemerPubkey, now)
    .run();
  if (!insert.success) {
    return json({ status: 500, body: { ok: false, error: "db_insert_failed" } });
  }
  let relays: ReadonlyArray<string> = [];
  try {
    const parsedRelays: unknown = JSON.parse(row.relays_json);
    if (Array.isArray(parsedRelays)) {
      relays = parsedRelays.filter((r: unknown): r is string => isString(r) && r.trim().length > 0).map((r: string): string => r.trim());
    }
  } catch {
    relays = [];
  }
  const response: InviteRedeemResponse = {
    inviteId: row.invite_id,
    inviterPubkey: row.inviter_pubkey,
    communityLabel: row.community_label,
    relays,
    expiresAtUnixSeconds: row.expires_at_unix_seconds
  };
  return json({ status: 200, body: { ok: true, data: response } });
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return json({ status: 204, body: {} });
    }
    const url = new URL(request.url);
    const path = url.pathname;
    if (request.method === "GET" && path === "/health") {
      return json({ status: 200, body: { ok: true, environment: env.ENVIRONMENT } });
    }
    if (request.method === "POST" && path === "/invites/create") {
      return await handleInviteCreate(request, env);
    }
    if (request.method === "POST" && path === "/invites/redeem") {
      return await handleInviteRedeem(request, env);
    }
    return notFound();
  }
};
