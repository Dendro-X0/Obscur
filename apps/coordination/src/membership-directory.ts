import { verifyMembershipDeltaSignature } from "@dweb/coordination-contracts";
import { evaluateMembershipDeltaAcl } from "./membership-delta-acl";

type Env = Readonly<{ DB: D1Database }>;

type JsonObject = Readonly<Record<string, unknown>>;

export type MembershipDeltaAction = "join" | "leave" | "expel";

export type MembershipDeltaBody = Readonly<{
  action: MembershipDeltaAction;
  subjectPubkey: string;
  actorPubkey: string;
  createdAtUnixMs: number;
  signature: string;
}>;

export type MembershipDeltaRecord = Readonly<{
  deltaId: string;
  communityId: string;
  seq: number;
  action: MembershipDeltaAction;
  subjectPubkey: string;
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

const bytesToHex = (bytes: Uint8Array): string => {
  let out = "";
  for (let i = 0; i < bytes.length; i += 1) {
    out += bytes[i]!.toString(16).padStart(2, "0");
  }
  return out;
};

const sha256Hex = async (input: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return bytesToHex(new Uint8Array(digest));
};

const parseDeltaBody = (value: JsonObject): MembershipDeltaBody | null => {
  const action = value.action;
  const subjectPubkey = value.subjectPubkey;
  const actorPubkey = value.actorPubkey;
  const createdAtUnixMs = value.createdAtUnixMs;
  const signature = value.signature;
  if (
    (action !== "join" && action !== "leave" && action !== "expel")
    || !isString(subjectPubkey)
    || !isString(actorPubkey)
    || typeof createdAtUnixMs !== "number"
    || !Number.isFinite(createdAtUnixMs)
    || !isString(signature)
  ) {
    return null;
  }
  return {
    action,
    subjectPubkey: subjectPubkey.trim(),
    actorPubkey: actorPubkey.trim(),
    createdAtUnixMs: Math.floor(createdAtUnixMs),
    signature: signature.trim(),
  };
};

const parseDeltaRow = (row: unknown): MembershipDeltaRecord | null => {
  if (!isRecord(row)) {
    return null;
  }
  const deltaId = row.delta_id;
  const communityId = row.community_id;
  const seq = row.seq;
  const action = row.action;
  const subjectPubkey = row.subject_pubkey;
  const actorPubkey = row.actor_pubkey;
  const createdAtUnixMs = row.created_at_unix_ms;
  const signature = row.signature;
  if (
    !isString(deltaId)
    || !isString(communityId)
    || typeof seq !== "number"
    || (action !== "join" && action !== "leave" && action !== "expel")
    || !isString(subjectPubkey)
    || !isString(actorPubkey)
    || typeof createdAtUnixMs !== "number"
    || !isString(signature)
  ) {
    return null;
  }
  return {
    deltaId,
    communityId,
    seq,
    action,
    subjectPubkey,
    actorPubkey,
    createdAtUnixMs,
    signature,
  };
};

export const handleMembershipHead = async (
  communityId: string,
  env: Env,
): Promise<Response> => {
  const normalizedId = communityId.trim();
  if (!normalizedId) {
    return badRequest("invalid_community_id");
  }
  const row = await env.DB.prepare(
    "SELECT latest_seq, head_hash, updated_at_unix_ms FROM community_membership_heads WHERE community_id = ?1",
  )
    .bind(normalizedId)
    .first();
  if (!isRecord(row)) {
    return json(200, {
      ok: true,
      data: { communityId: normalizedId, seq: 0, headHash: "", updatedAtUnixMs: 0 },
    });
  }
  return json(200, {
    ok: true,
    data: {
      communityId: normalizedId,
      seq: typeof row.latest_seq === "number" ? row.latest_seq : 0,
      headHash: isString(row.head_hash) ? row.head_hash : "",
      updatedAtUnixMs: typeof row.updated_at_unix_ms === "number" ? row.updated_at_unix_ms : 0,
    },
  });
};

export const handleMembershipDeltasSince = async (
  communityId: string,
  sinceSeq: number,
  env: Env,
): Promise<Response> => {
  const normalizedId = communityId.trim();
  if (!normalizedId) {
    return badRequest("invalid_community_id");
  }
  const safeSince = Number.isFinite(sinceSeq) && sinceSeq >= 0 ? Math.floor(sinceSeq) : 0;
  const result = await env.DB.prepare(
    `SELECT delta_id, community_id, seq, action, subject_pubkey, actor_pubkey, created_at_unix_ms, signature
     FROM community_membership_deltas
     WHERE community_id = ?1 AND seq > ?2
     ORDER BY seq ASC
     LIMIT 200`,
  )
    .bind(normalizedId, safeSince)
    .all();
  const deltas = (result.results ?? [])
    .map((row) => parseDeltaRow(row))
    .filter((row): row is MembershipDeltaRecord => row !== null);
  return json(200, { ok: true, data: { communityId: normalizedId, deltas } });
};

export const handleMembershipDeltaAppend = async (
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
  const deltaBody = parseDeltaBody(body);
  if (!deltaBody) {
    return badRequest("invalid_body");
  }
  const validSig = await verifyMembershipDeltaSignature({
    communityId: normalizedId,
    ...deltaBody,
  });
  if (!validSig) {
    return json(401, { ok: false, error: "invalid_signature" });
  }

  const existingDeltaRows = await env.DB.prepare(
    `SELECT seq, action, subject_pubkey, actor_pubkey
     FROM community_membership_deltas
     WHERE community_id = ?1
     ORDER BY seq ASC`,
  )
    .bind(normalizedId)
    .all();
  const existingDeltas = (existingDeltaRows.results ?? [])
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

  const aclDecision = evaluateMembershipDeltaAcl({
    existingDeltas,
    delta: deltaBody,
  });
  if (!aclDecision.allowed) {
    return json(403, { ok: false, error: aclDecision.error });
  }

  const headRow = await env.DB.prepare(
    "SELECT latest_seq FROM community_membership_heads WHERE community_id = ?1",
  )
    .bind(normalizedId)
    .first();
  const currentSeq = isRecord(headRow) && typeof headRow.latest_seq === "number"
    ? headRow.latest_seq
    : 0;
  const nextSeq = currentSeq + 1;
  const deltaId = crypto.randomUUID();
  const headHash = await sha256Hex(`${normalizedId}:${nextSeq}:${deltaBody.action}:${deltaBody.subjectPubkey}`);
  const nowMs = Date.now();

  const insert = await env.DB.prepare(
    `INSERT INTO community_membership_deltas
      (delta_id, community_id, seq, action, subject_pubkey, actor_pubkey, created_at_unix_ms, signature)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
  )
    .bind(
      deltaId,
      normalizedId,
      nextSeq,
      deltaBody.action,
      deltaBody.subjectPubkey.toLowerCase(),
      deltaBody.actorPubkey.toLowerCase(),
      deltaBody.createdAtUnixMs,
      deltaBody.signature,
    )
    .run();
  if (!insert.success) {
    return json(500, { ok: false, error: "db_insert_failed" });
  }

  await env.DB.prepare(
    `INSERT INTO community_membership_heads (community_id, latest_seq, head_hash, updated_at_unix_ms)
     VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT(community_id) DO UPDATE SET
       latest_seq = excluded.latest_seq,
       head_hash = excluded.head_hash,
       updated_at_unix_ms = excluded.updated_at_unix_ms`,
  )
    .bind(normalizedId, nextSeq, headHash, nowMs)
    .run();

  return json(200, {
    ok: true,
    data: {
      communityId: normalizedId,
      seq: nextSeq,
      deltaId,
      action: deltaBody.action,
      subjectPubkey: deltaBody.subjectPubkey,
      actorPubkey: deltaBody.actorPubkey,
      createdAtUnixMs: deltaBody.createdAtUnixMs,
    },
  });
  } catch (error) {
    const message = error instanceof Error ? error.message : "membership_delta_failed";
    return json(500, { ok: false, error: message });
  }
};

export const matchMembershipDirectoryPath = (
  path: string,
): Readonly<{ communityId: string; resource: "head" | "deltas" | "delta" }> | null => {
  const match = /^\/communities\/([^/]+)\/membership\/(head|deltas|delta)$/.exec(path);
  if (!match) {
    return null;
  }
  const communityId = decodeURIComponent(match[1] ?? "").trim();
  const resource = match[2] as "head" | "deltas" | "delta";
  if (!communityId) {
    return null;
  }
  return { communityId, resource };
};
