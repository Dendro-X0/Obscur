import {
  ROOM_KEY_WRAP_SCHEME_V1,
  verifyRoomKeyWrapSignature,
} from "@dweb/coordination-contracts";
import type { MembershipDeltaAction } from "./membership-directory";
import { evaluateRoomKeyWrapAcl } from "./membership-room-key-wrap-acl";

type Env = Readonly<{ DB: D1Database }>;

type JsonObject = Readonly<Record<string, unknown>>;

export type RoomKeyWrapBody = Readonly<{
  subjectPubkey: string;
  scheme: typeof ROOM_KEY_WRAP_SCHEME_V1;
  ciphertext: string;
  actorPubkey: string;
  createdAtUnixMs: number;
  signature: string;
}>;

export type RoomKeyWrapRecord = Readonly<{
  wrapId: string;
  communityId: string;
  subjectPubkey: string;
  wrapSeq: number;
  scheme: typeof ROOM_KEY_WRAP_SCHEME_V1;
  ciphertext: string;
  actorPubkey: string;
  createdAtUnixMs: number;
  signature: string;
}>;

const json = (status: number, body: JsonObject): Response => new Response(JSON.stringify(body), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type, authorization, x-requested-with",
  },
});

const badRequest = (error: string): Response => json(400, { ok: false, error });

const isString = (value: unknown): value is string => typeof value === "string";

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === "object" && value !== null
);

const FORBIDDEN_CLEARTEXT_KEY_FIELDS = ["roomKeyHex", "room_key_hex", "roomKey"] as const;

const containsForbiddenCleartextKeyFields = (body: JsonObject): boolean => (
  FORBIDDEN_CLEARTEXT_KEY_FIELDS.some((field) => field in body)
);

const looksLikeRawRoomKeyHex = (value: string): boolean => (
  /^[0-9a-fA-F]{64}$/.test(value.trim())
);

export const parseRoomKeyWrapBody = (value: JsonObject): RoomKeyWrapBody | null => {
  const subjectPubkey = value.subjectPubkey;
  const scheme = value.scheme;
  const ciphertext = value.ciphertext;
  const actorPubkey = value.actorPubkey;
  const createdAtUnixMs = value.createdAtUnixMs;
  const signature = value.signature;
  if (
    !isString(subjectPubkey)
    || scheme !== ROOM_KEY_WRAP_SCHEME_V1
    || !isString(ciphertext)
    || !isString(actorPubkey)
    || typeof createdAtUnixMs !== "number"
    || !Number.isFinite(createdAtUnixMs)
    || !isString(signature)
  ) {
    return null;
  }
  const trimmedCiphertext = ciphertext.trim();
  if (trimmedCiphertext.length === 0 || looksLikeRawRoomKeyHex(trimmedCiphertext)) {
    return null;
  }
  return {
    subjectPubkey: subjectPubkey.trim(),
    scheme: ROOM_KEY_WRAP_SCHEME_V1,
    ciphertext: trimmedCiphertext,
    actorPubkey: actorPubkey.trim(),
    createdAtUnixMs: Math.floor(createdAtUnixMs),
    signature: signature.trim(),
  };
};

const parseWrapRow = (row: unknown): RoomKeyWrapRecord | null => {
  if (!isRecord(row)) {
    return null;
  }
  const wrapId = row.wrap_id;
  const communityId = row.community_id;
  const subjectPubkey = row.subject_pubkey;
  const wrapSeq = row.wrap_seq;
  const scheme = row.scheme;
  const ciphertext = row.ciphertext;
  const actorPubkey = row.actor_pubkey;
  const createdAtUnixMs = row.created_at_unix_ms;
  const signature = row.signature;
  if (
    !isString(wrapId)
    || !isString(communityId)
    || !isString(subjectPubkey)
    || typeof wrapSeq !== "number"
    || scheme !== ROOM_KEY_WRAP_SCHEME_V1
    || !isString(ciphertext)
    || !isString(actorPubkey)
    || typeof createdAtUnixMs !== "number"
    || !isString(signature)
  ) {
    return null;
  }
  return {
    wrapId,
    communityId,
    subjectPubkey,
    wrapSeq,
    scheme: ROOM_KEY_WRAP_SCHEME_V1,
    ciphertext,
    actorPubkey,
    createdAtUnixMs,
    signature,
  };
};

const loadMembershipDeltaAclRows = async (
  communityId: string,
  env: Env,
): Promise<ReadonlyArray<{
  seq: number;
  action: MembershipDeltaAction;
  subjectPubkey: string;
  actorPubkey: string;
}>> => {
  const existingDeltaRows = await env.DB.prepare(
    `SELECT seq, action, subject_pubkey, actor_pubkey
     FROM community_membership_deltas
     WHERE community_id = ?1
     ORDER BY seq ASC`,
  )
    .bind(communityId)
    .all();
  return (existingDeltaRows.results ?? [])
    .map((row) => {
      if (!isRecord(row)) {
        return null;
      }
      const seq = row.seq;
      const action = row.action;
      const subjectPubkey = row.subject_pubkey;
      const actorPubkey = row.actor_pubkey;
      if (
        typeof seq !== "number"
        || (action !== "join" && action !== "leave" && action !== "expel")
        || !isString(subjectPubkey)
        || !isString(actorPubkey)
      ) {
        return null;
      }
      return {
        seq,
        action,
        subjectPubkey,
        actorPubkey,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
};

export const handleRoomKeyWrapAppend = async (
  communityId: string,
  request: Request,
  env: Env,
): Promise<Response> => {
  try {
    const normalizedId = communityId.trim();
    if (!normalizedId) {
      return badRequest("invalid_community_id");
    }
    let body: JsonObject;
    try {
      const parsed: unknown = await request.json();
      if (!isRecord(parsed)) {
        return badRequest("invalid_json");
      }
      body = parsed;
    } catch {
      return badRequest("invalid_json");
    }
    if (containsForbiddenCleartextKeyFields(body)) {
      return badRequest("plaintext_room_key_forbidden");
    }
    const wrapBody = parseRoomKeyWrapBody(body);
    if (!wrapBody) {
      return badRequest("invalid_body");
    }

    const nextWrapSeqRow = await env.DB.prepare(
      `SELECT COALESCE(MAX(wrap_seq), 0) AS max_seq
       FROM community_member_room_key_wraps
       WHERE community_id = ?1 AND subject_pubkey = ?2`,
    )
      .bind(normalizedId, wrapBody.subjectPubkey.toLowerCase())
      .first();
    const currentMaxSeq = isRecord(nextWrapSeqRow) && typeof nextWrapSeqRow.max_seq === "number"
      ? nextWrapSeqRow.max_seq
      : 0;
    const nextWrapSeq = currentMaxSeq + 1;

    const validSig = await verifyRoomKeyWrapSignature({
      communityId: normalizedId,
      subjectPubkey: wrapBody.subjectPubkey,
      wrapSeq: nextWrapSeq,
      scheme: wrapBody.scheme,
      ciphertext: wrapBody.ciphertext,
      actorPubkey: wrapBody.actorPubkey,
      createdAtUnixMs: wrapBody.createdAtUnixMs,
      signature: wrapBody.signature,
    });
    if (!validSig) {
      return json(401, { ok: false, error: "invalid_signature" });
    }

    const existingDeltas = await loadMembershipDeltaAclRows(normalizedId, env);
    const aclDecision = evaluateRoomKeyWrapAcl({
      existingDeltas,
      subjectPubkey: wrapBody.subjectPubkey,
      actorPubkey: wrapBody.actorPubkey,
    });
    if (!aclDecision.allowed) {
      return json(403, { ok: false, error: aclDecision.error });
    }

    const wrapId = crypto.randomUUID();
    const insert = await env.DB.prepare(
      `INSERT INTO community_member_room_key_wraps
        (wrap_id, community_id, subject_pubkey, wrap_seq, scheme, ciphertext, actor_pubkey, created_at_unix_ms, signature)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
    )
      .bind(
        wrapId,
        normalizedId,
        wrapBody.subjectPubkey.toLowerCase(),
        nextWrapSeq,
        wrapBody.scheme,
        wrapBody.ciphertext,
        wrapBody.actorPubkey.toLowerCase(),
        wrapBody.createdAtUnixMs,
        wrapBody.signature,
      )
      .run();
    if (!insert.success) {
      return json(500, { ok: false, error: "db_insert_failed" });
    }

    return json(200, {
      ok: true,
      data: {
        communityId: normalizedId,
        wrapId,
        wrapSeq: nextWrapSeq,
        subjectPubkey: wrapBody.subjectPubkey,
        actorPubkey: wrapBody.actorPubkey,
        scheme: wrapBody.scheme,
        createdAtUnixMs: wrapBody.createdAtUnixMs,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "room_key_wrap_failed";
    return json(500, { ok: false, error: message });
  }
};

export const handleRoomKeyWrapsSince = async (
  communityId: string,
  sinceWrapSeq: number,
  env: Env,
): Promise<Response> => {
  const normalizedId = communityId.trim();
  if (!normalizedId) {
    return badRequest("invalid_community_id");
  }
  const safeSince = Number.isFinite(sinceWrapSeq) && sinceWrapSeq >= 0 ? Math.floor(sinceWrapSeq) : 0;
  const result = await env.DB.prepare(
    `SELECT wrap_id, community_id, subject_pubkey, wrap_seq, scheme, ciphertext, actor_pubkey, created_at_unix_ms, signature
     FROM community_member_room_key_wraps
     WHERE community_id = ?1 AND wrap_seq > ?2
     ORDER BY wrap_seq ASC
     LIMIT 200`,
  )
    .bind(normalizedId, safeSince)
    .all();
  const wraps = (result.results ?? [])
    .map((row) => parseWrapRow(row))
    .filter((row): row is RoomKeyWrapRecord => row !== null);
  return json(200, { ok: true, data: { communityId: normalizedId, wraps } });
};

export const matchMembershipRoomKeyWrapPath = (
  path: string,
): Readonly<{ communityId: string; resource: "room-key-wrap" | "room-key-wraps" }> | null => {
  const match = /^\/communities\/([^/]+)\/membership\/(room-key-wrap|room-key-wraps)$/.exec(path);
  if (!match) {
    return null;
  }
  const communityId = decodeURIComponent(match[1] ?? "").trim();
  const resource = match[2] as "room-key-wrap" | "room-key-wraps";
  if (!communityId) {
    return null;
  }
  return { communityId, resource };
};
