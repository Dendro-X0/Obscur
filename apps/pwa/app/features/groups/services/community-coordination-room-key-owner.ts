import {
  ROOM_KEY_WRAP_SCHEME_V1,
  signRoomKeyWrap,
} from "@dweb/coordination-contracts";
import { nip04Decrypt } from "@dweb/nostr/nip04-decrypt";
import { nip04Encrypt } from "@dweb/nostr/nip04-encrypt";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { logAppEvent } from "@/app/shared/log-app-event";
import { roomKeyStore, type RoomKeyStore } from "../../crypto/room-key-store";
import {
  CoordinationFetchError,
  fetchCoordinationWithTimeout,
} from "./community-coordination-fetch";
import { resolveActorPrivateKeyForMembershipDeltaSigning } from "./community-coordination-membership-client";
import { getCoordinationBaseUrl, isCoordinationConfigured } from "./community-membership-sync-mode";

export const COMMUNITY_COORDINATION_ROOM_KEY_OWNER_ID = "community-coordination-room-key-owner" as const;

export const ROOM_KEY_WRAP_INNER_VERSION = 1 as const;

const ROOM_KEY_HEX_PATTERN = /^[0-9a-fA-F]{64}$/;

export type CoordinationRoomKeyWrapRecord = Readonly<{
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

export type CoordinationRoomKeyWrapFetchResult = Readonly<{
  ok: true;
  wraps: ReadonlyArray<CoordinationRoomKeyWrapRecord>;
}> | Readonly<{
  ok: false;
  status: number | null;
  error: string;
}>;

export type CoordinationRoomKeyResolveSource = "hit_local" | "hit_coordination" | "miss";

export type CoordinationRoomKeyResolveResult = Readonly<{
  roomKeyHex: string | null;
  source: CoordinationRoomKeyResolveSource;
}>;

type RoomKeyWrapInnerPayload = Readonly<{
  v: typeof ROOM_KEY_WRAP_INNER_VERSION;
  groupId: string;
  roomKeyHex: string;
}>;

const normalizePubkey = (pubkey: string): string => pubkey.trim().toLowerCase();

const encodeCommunityPath = (communityId: string): string => (
  encodeURIComponent(communityId.trim())
);

const parseApiData = <T>(payload: unknown): T | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const record = payload as Record<string, unknown>;
  if (record.ok !== true || !record.data || typeof record.data !== "object") {
    return null;
  }
  return record.data as T;
};

const isRoomKeyWrapInnerPayload = (value: unknown): value is RoomKeyWrapInnerPayload => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return record.v === ROOM_KEY_WRAP_INNER_VERSION
    && typeof record.groupId === "string"
    && record.groupId.trim().length > 0
    && typeof record.roomKeyHex === "string"
    && ROOM_KEY_HEX_PATTERN.test(record.roomKeyHex.trim());
};

export const buildRoomKeyWrapInnerPayload = (
  groupId: string,
  roomKeyHex: string,
): RoomKeyWrapInnerPayload | null => {
  const trimmedGroupId = groupId.trim();
  const trimmedRoomKeyHex = roomKeyHex.trim();
  if (!trimmedGroupId || !ROOM_KEY_HEX_PATTERN.test(trimmedRoomKeyHex)) {
    return null;
  }
  return {
    v: ROOM_KEY_WRAP_INNER_VERSION,
    groupId: trimmedGroupId,
    roomKeyHex: trimmedRoomKeyHex,
  };
};

export const parseRoomKeyWrapInnerPayload = (plaintext: string): RoomKeyWrapInnerPayload | null => {
  try {
    const parsed: unknown = JSON.parse(plaintext);
    return isRoomKeyWrapInnerPayload(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const resolveNextWrapSeqForSubject = (
  wraps: ReadonlyArray<CoordinationRoomKeyWrapRecord>,
  subjectPubkey: string,
): number => {
  const normalizedSubject = normalizePubkey(subjectPubkey);
  let maxSeq = 0;
  wraps.forEach((wrap) => {
    if (normalizePubkey(wrap.subjectPubkey) !== normalizedSubject) {
      return;
    }
    if (wrap.wrapSeq > maxSeq) {
      maxSeq = wrap.wrapSeq;
    }
  });
  return maxSeq + 1;
};

export const selectLatestWrapForSubject = (
  wraps: ReadonlyArray<CoordinationRoomKeyWrapRecord>,
  subjectPubkey: string,
): CoordinationRoomKeyWrapRecord | null => {
  const normalizedSubject = normalizePubkey(subjectPubkey);
  let latest: CoordinationRoomKeyWrapRecord | null = null;
  wraps.forEach((wrap) => {
    if (normalizePubkey(wrap.subjectPubkey) !== normalizedSubject) {
      return;
    }
    if (!latest || wrap.wrapSeq > latest.wrapSeq) {
      latest = wrap;
    }
  });
  return latest;
};

export const wrapRoomKeyForCoordination = async (params: Readonly<{
  groupId: string;
  roomKeyHex: string;
  subjectPubkey: PublicKeyHex;
  actorPrivateKeyHex: PrivateKeyHex;
}>): Promise<Readonly<{ ok: true; ciphertext: string }> | Readonly<{ ok: false; error: string }>> => {
  const inner = buildRoomKeyWrapInnerPayload(params.groupId, params.roomKeyHex);
  if (!inner) {
    return { ok: false, error: "invalid_room_key_payload" };
  }
  try {
    const actorPrivateKeyHex = await resolveActorPrivateKeyForMembershipDeltaSigning(
      params.actorPrivateKeyHex,
    );
    const ciphertext = await nip04Encrypt({
      senderPrivateKeyHex: actorPrivateKeyHex,
      recipientPublicKeyHex: params.subjectPubkey,
      plaintext: JSON.stringify(inner),
    });
    return { ok: true, ciphertext };
  } catch {
    return { ok: false, error: "nip04_encrypt_failed" };
  }
};

export const unwrapRoomKeyFromCoordinationCiphertext = async (params: Readonly<{
  ciphertext: string;
  actorPubkey: PublicKeyHex;
  recipientPrivateKeyHex: PrivateKeyHex;
  expectedGroupId?: string;
}>): Promise<Readonly<{ ok: true; roomKeyHex: string; groupId: string }> | Readonly<{ ok: false; error: string }>> => {
  try {
    const recipientPrivateKeyHex = await resolveActorPrivateKeyForMembershipDeltaSigning(
      params.recipientPrivateKeyHex,
    );
    const plaintext = await nip04Decrypt({
      recipientPrivateKeyHex,
      senderPublicKeyHex: params.actorPubkey,
      payload: params.ciphertext,
    });
    const inner = parseRoomKeyWrapInnerPayload(plaintext);
    if (!inner) {
      return { ok: false, error: "invalid_inner_payload" };
    }
    if (params.expectedGroupId?.trim() && inner.groupId !== params.expectedGroupId.trim()) {
      return { ok: false, error: "group_id_mismatch" };
    }
    return { ok: true, roomKeyHex: inner.roomKeyHex, groupId: inner.groupId };
  } catch {
    return { ok: false, error: "nip04_decrypt_failed" };
  }
};

export const fetchCoordinationRoomKeyWrapsSince = async (
  communityId: string,
  sinceWrapSeq = 0,
): Promise<CoordinationRoomKeyWrapFetchResult> => {
  const baseUrl = getCoordinationBaseUrl();
  if (!baseUrl) {
    return { ok: false, status: null, error: "coordination_not_configured" };
  }
  const safeSince = Number.isFinite(sinceWrapSeq) && sinceWrapSeq >= 0 ? Math.floor(sinceWrapSeq) : 0;
  try {
    const response = await fetchCoordinationWithTimeout(
      `${baseUrl}/communities/${encodeCommunityPath(communityId)}/membership/room-key-wraps?sinceSeq=${safeSince}`,
      { method: "GET" },
    );
    if (!response.ok) {
      return { ok: false, status: response.status, error: `http_${response.status}` };
    }
    const json: unknown = await response.json();
    const data = parseApiData<{ wraps: ReadonlyArray<CoordinationRoomKeyWrapRecord> }>(json);
    return { ok: true, wraps: data?.wraps ?? [] };
  } catch (error) {
    return {
      ok: false,
      status: null,
      error: error instanceof Error ? error.message : "fetch_failed",
    };
  }
};

export const publishCoordinationRoomKeyWrap = async (params: Readonly<{
  communityId: string;
  groupId: string;
  roomKeyHex: string;
  subjectPubkey: PublicKeyHex;
  actorPubkey: PublicKeyHex;
  actorPrivateKeyHex: PrivateKeyHex;
  createdAtUnixMs?: number;
  nextWrapSeq?: number;
}>): Promise<Readonly<{ success: true; wrapSeq: number }> | Readonly<{ success: false; errorMessage: string }>> => {
  const baseUrl = getCoordinationBaseUrl();
  if (!baseUrl) {
    return { success: false, errorMessage: "coordination_not_configured" };
  }

  let nextWrapSeq = params.nextWrapSeq;
  if (nextWrapSeq === undefined) {
    const fetched = await fetchCoordinationRoomKeyWrapsSince(params.communityId, 0);
    if (!fetched.ok) {
      return { success: false, errorMessage: fetched.error };
    }
    nextWrapSeq = resolveNextWrapSeqForSubject(fetched.wraps, params.subjectPubkey);
  }

  const wrapped = await wrapRoomKeyForCoordination({
    groupId: params.groupId,
    roomKeyHex: params.roomKeyHex,
    subjectPubkey: params.subjectPubkey,
    actorPrivateKeyHex: params.actorPrivateKeyHex,
  });
  if (!wrapped.ok) {
    return { success: false, errorMessage: wrapped.error };
  }

  const createdAtUnixMs = params.createdAtUnixMs ?? Date.now();
  let signature: string;
  try {
    const actorPrivateKeyHex = await resolveActorPrivateKeyForMembershipDeltaSigning(
      params.actorPrivateKeyHex,
    );
    signature = await signRoomKeyWrap({
      communityId: params.communityId,
      subjectPubkey: params.subjectPubkey,
      wrapSeq: nextWrapSeq,
      scheme: ROOM_KEY_WRAP_SCHEME_V1,
      ciphertext: wrapped.ciphertext,
      actorPubkey: params.actorPubkey,
      createdAtUnixMs,
      actorPrivateKeyHex,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "sign_failed";
    return {
      success: false,
      errorMessage: message === "native_signing_unavailable" ? message : "sign_failed",
    };
  }

  let response: Response;
  try {
    response = await fetchCoordinationWithTimeout(
      `${baseUrl}/communities/${encodeCommunityPath(params.communityId)}/membership/room-key-wrap`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subjectPubkey: params.subjectPubkey,
          scheme: ROOM_KEY_WRAP_SCHEME_V1,
          ciphertext: wrapped.ciphertext,
          actorPubkey: params.actorPubkey,
          createdAtUnixMs,
          signature,
        }),
      },
    );
  } catch (error) {
    if (error instanceof CoordinationFetchError) {
      return { success: false, errorMessage: error.message };
    }
    return { success: false, errorMessage: "coordination_unreachable" };
  }

  if (!response.ok) {
    let errorMessage = `http_${response.status}`;
    try {
      const errorJson: unknown = await response.json();
      if (errorJson && typeof errorJson === "object") {
        const record = errorJson as Record<string, unknown>;
        if (typeof record.error === "string" && record.error.trim().length > 0) {
          errorMessage = `http_${response.status}:${record.error.trim()}`;
        }
      }
    } catch {
      // keep status-only code
    }
    return { success: false, errorMessage };
  }

  const json: unknown = await response.json();
  const data = parseApiData<{ wrapSeq: number }>(json);
  const wrapSeq = data?.wrapSeq ?? nextWrapSeq;
  logAppEvent({
    name: "groups.coordination_room_key_wrap_published",
    level: "info",
    scope: { feature: "groups", action: "coordination_room_key_wrap_publish" },
    context: {
      communityId: params.communityId,
      groupId: params.groupId,
      wrapSeq,
      owner: COMMUNITY_COORDINATION_ROOM_KEY_OWNER_ID,
    },
  });
  return { success: true, wrapSeq };
};

export const materializeRoomKeysFromCoordinationWraps = async (params: Readonly<{
  groupId: string;
  communityId: string;
  localPubkey: PublicKeyHex;
  localPrivateKeyHex: PrivateKeyHex;
  wraps: ReadonlyArray<CoordinationRoomKeyWrapRecord>;
  activeMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
  store?: RoomKeyStore;
}>): Promise<Readonly<{ materialized: boolean; roomKeyHex: string | null; error?: string }>> => {
  const store = params.store ?? roomKeyStore;
  const normalizedLocal = normalizePubkey(params.localPubkey);
  if (params.activeMemberPubkeys && params.activeMemberPubkeys.length > 0) {
    const active = params.activeMemberPubkeys.some(
      (pubkey) => normalizePubkey(pubkey) === normalizedLocal,
    );
    if (!active) {
      return { materialized: false, roomKeyHex: null, error: "subject_not_active" };
    }
  }

  const latestWrap = selectLatestWrapForSubject(params.wraps, params.localPubkey);
  if (!latestWrap) {
    return { materialized: false, roomKeyHex: null, error: "wrap_not_found" };
  }

  const decrypted = await unwrapRoomKeyFromCoordinationCiphertext({
    ciphertext: latestWrap.ciphertext,
    actorPubkey: latestWrap.actorPubkey as PublicKeyHex,
    recipientPrivateKeyHex: params.localPrivateKeyHex,
    expectedGroupId: params.groupId,
  });
  if (!decrypted.ok) {
    return { materialized: false, roomKeyHex: null, error: decrypted.error };
  }

  await store.upsertRoomKeyRecord({
    groupId: params.groupId,
    roomKeyHex: decrypted.roomKeyHex,
    createdAt: latestWrap.createdAtUnixMs,
  });

  logAppEvent({
    name: "groups.coordination_room_key_materialized",
    level: "info",
    scope: { feature: "groups", action: "coordination_room_key_materialize" },
    context: {
      communityId: params.communityId,
      groupId: params.groupId,
      wrapSeq: latestWrap.wrapSeq,
      owner: COMMUNITY_COORDINATION_ROOM_KEY_OWNER_ID,
    },
  });

  return { materialized: true, roomKeyHex: decrypted.roomKeyHex };
};

/** Membership health + send share this read path (R1 / group-room-key-missing). */
export const resolveRoomKeyHexForMembershipHealthPanel = async (params: Readonly<{
  groupIdCandidates: ReadonlyArray<string>;
  communityId?: string;
  localPubkey?: PublicKeyHex | null;
  localPrivateKeyHex?: PrivateKeyHex | null;
  activeMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
  store?: RoomKeyStore;
}>): Promise<string | null> => {
  const store = params.store ?? roomKeyStore;
  const groupIdCandidates = Array.from(new Set(
    params.groupIdCandidates
      .map((value) => value.trim())
      .filter((value) => value.length > 0),
  ));

  for (const groupId of groupIdCandidates) {
    const localKey = (await store.getRoomKey(groupId))?.trim() ?? "";
    if (localKey) {
      return localKey;
    }
  }

  const communityId = params.communityId?.trim() ?? "";
  const localPubkey = params.localPubkey?.trim() ?? "";
  const localPrivateKeyHex = params.localPrivateKeyHex;
  const primaryGroupId = groupIdCandidates[0];
  if (!communityId || !localPubkey || !localPrivateKeyHex || !primaryGroupId) {
    return null;
  }

  const resolved = await resolveRoomKeyForCommunityAction({
    groupId: primaryGroupId,
    communityId,
    localPubkey: localPubkey as PublicKeyHex,
    localPrivateKeyHex,
    activeMemberPubkeys: params.activeMemberPubkeys,
    store,
  });
  return resolved.roomKeyHex?.trim() || null;
};

/** Relay ingest decrypt — same local → coordination cascade as send/health (R5). */
export const resolveRoomKeyHexForGroupRelayIngest = async (params: Readonly<{
  groupId: string;
  communityId?: string;
  localPubkey: PublicKeyHex;
  localPrivateKeyHex?: PrivateKeyHex | null;
  groupIdCandidates?: ReadonlyArray<string>;
  activeMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
  store?: RoomKeyStore;
}>): Promise<string | null> => {
  const groupIdCandidates = params.groupIdCandidates?.length
    ? params.groupIdCandidates
    : [params.groupId];
  return resolveRoomKeyHexForMembershipHealthPanel({
    groupIdCandidates,
    communityId: params.communityId,
    localPubkey: params.localPubkey,
    localPrivateKeyHex: params.localPrivateKeyHex ?? null,
    activeMemberPubkeys: params.activeMemberPubkeys,
    store: params.store,
  });
};

export const resolveRoomKeyForCommunityAction = async (params: Readonly<{
  groupId: string;
  communityId: string;
  localPubkey: PublicKeyHex;
  localPrivateKeyHex: PrivateKeyHex;
  activeMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
  store?: RoomKeyStore;
}>): Promise<CoordinationRoomKeyResolveResult> => {
  const store = params.store ?? roomKeyStore;
  const localKey = (await store.getRoomKey(params.groupId))?.trim() ?? "";
  if (localKey) {
    logAppEvent({
      name: "groups.coordination_room_key_resolve",
      level: "debug",
      scope: { feature: "groups", action: "coordination_room_key_resolve" },
      context: {
        communityId: params.communityId,
        groupId: params.groupId,
        source: "hit_local",
        owner: COMMUNITY_COORDINATION_ROOM_KEY_OWNER_ID,
      },
    });
    return { roomKeyHex: localKey, source: "hit_local" };
  }

  const fetched = await fetchCoordinationRoomKeyWrapsSince(params.communityId, 0);
  if (!fetched.ok) {
    logAppEvent({
      name: "groups.coordination_room_key_resolve",
      level: "warn",
      scope: { feature: "groups", action: "coordination_room_key_resolve" },
      context: {
        communityId: params.communityId,
        groupId: params.groupId,
        source: "miss",
        error: fetched.error,
        owner: COMMUNITY_COORDINATION_ROOM_KEY_OWNER_ID,
      },
    });
    return { roomKeyHex: null, source: "miss" };
  }

  const materialized = await materializeRoomKeysFromCoordinationWraps({
    groupId: params.groupId,
    communityId: params.communityId,
    localPubkey: params.localPubkey,
    localPrivateKeyHex: params.localPrivateKeyHex,
    wraps: fetched.wraps,
    activeMemberPubkeys: params.activeMemberPubkeys,
    store,
  });

  if (materialized.materialized && materialized.roomKeyHex) {
    logAppEvent({
      name: "groups.coordination_room_key_resolve",
      level: "info",
      scope: { feature: "groups", action: "coordination_room_key_resolve" },
      context: {
        communityId: params.communityId,
        groupId: params.groupId,
        source: "hit_coordination",
        owner: COMMUNITY_COORDINATION_ROOM_KEY_OWNER_ID,
      },
    });
    return { roomKeyHex: materialized.roomKeyHex, source: "hit_coordination" };
  }

  logAppEvent({
    name: "groups.coordination_room_key_resolve",
    level: "warn",
    scope: { feature: "groups", action: "coordination_room_key_resolve" },
    context: {
      communityId: params.communityId,
      groupId: params.groupId,
      source: "miss",
      error: materialized.error ?? "unknown",
      owner: COMMUNITY_COORDINATION_ROOM_KEY_OWNER_ID,
    },
  });
  return { roomKeyHex: null, source: "miss" };
};

/** Best-effort self-wrap after coordination join delta succeeds (C2b). Does not throw. */
export const publishSelfCoordinationRoomKeyWrapAfterJoin = async (params: Readonly<{
  communityId: string;
  groupId: string;
  memberPubkey: PublicKeyHex;
  actorPubkey: PublicKeyHex;
  actorPrivateKeyHex: PrivateKeyHex;
  roomKeyHex?: string;
}>): Promise<Readonly<
  { ok: true; wrapSeq: number }
  | { ok: false; skipped: true; error: string }
  | { ok: false; skipped: false; error: string }
>> => {
  const roomKeyHex = params.roomKeyHex?.trim()
    || (await roomKeyStore.getRoomKey(params.groupId))?.trim()
    || "";
  if (!roomKeyHex) {
    logAppEvent({
      name: "groups.coordination_room_key_wrap_skipped",
      level: "warn",
      scope: { feature: "groups", action: "coordination_room_key_wrap_publish" },
      context: {
        communityId: params.communityId,
        groupId: params.groupId,
        error: "room_key_missing",
        owner: COMMUNITY_COORDINATION_ROOM_KEY_OWNER_ID,
      },
    });
    return { ok: false, skipped: true, error: "room_key_missing" };
  }

  const result = await publishCoordinationRoomKeyWrap({
    communityId: params.communityId,
    groupId: params.groupId,
    roomKeyHex,
    subjectPubkey: params.memberPubkey,
    actorPubkey: params.actorPubkey,
    actorPrivateKeyHex: params.actorPrivateKeyHex,
  });

  if (result.success) {
    return { ok: true, wrapSeq: result.wrapSeq };
  }

  logAppEvent({
    name: "groups.coordination_room_key_wrap_publish_failed",
    level: "warn",
    scope: { feature: "groups", action: "coordination_room_key_wrap_publish" },
    context: {
      communityId: params.communityId,
      groupId: params.groupId,
      error: result.errorMessage,
      owner: COMMUNITY_COORDINATION_ROOM_KEY_OWNER_ID,
    },
  });
  return { ok: false, skipped: false, error: result.errorMessage };
};

export type InviteDistributionRoomKeySource = "hint" | "local_store" | "hit_local" | "hit_coordination" | "generated";

/** Resolve room key for invite send — hint, local store, then coordination (C5). Does not generate. */
export const resolveRoomKeyHexForInviteDistribution = async (params: Readonly<{
  groupId: string;
  communityId?: string;
  localPubkey: PublicKeyHex;
  localPrivateKeyHex: PrivateKeyHex;
  roomKeyHexHint?: string;
  store?: RoomKeyStore;
}>): Promise<Readonly<{ roomKeyHex: string | null; source: InviteDistributionRoomKeySource | "miss" }>> => {
  const hint = params.roomKeyHexHint?.trim();
  if (hint) {
    return { roomKeyHex: hint, source: "hint" };
  }
  const store = params.store ?? roomKeyStore;
  const localKey = (await store.getRoomKey(params.groupId))?.trim();
  if (localKey) {
    return { roomKeyHex: localKey, source: "local_store" };
  }
  const communityId = params.communityId?.trim();
  if (!communityId || !isCoordinationConfigured()) {
    return { roomKeyHex: null, source: "miss" };
  }
  const resolved = await resolveRoomKeyForCommunityAction({
    groupId: params.groupId,
    communityId,
    localPubkey: params.localPubkey,
    localPrivateKeyHex: params.localPrivateKeyHex,
    store,
  });
  if (resolved.roomKeyHex) {
    return {
      roomKeyHex: resolved.roomKeyHex,
      source: resolved.source === "hit_coordination" ? "hit_coordination" : "hit_local",
    };
  }
  return { roomKeyHex: null, source: "miss" };
};

export const ensureRoomKeyHexForInviteDistribution = async (params: Readonly<{
  groupId: string;
  communityId?: string;
  localPubkey: PublicKeyHex;
  localPrivateKeyHex: PrivateKeyHex;
  roomKeyHexHint?: string;
  generateRoomKey: () => Promise<string>;
  store?: RoomKeyStore;
}>): Promise<Readonly<{ roomKeyHex: string; source: InviteDistributionRoomKeySource }>> => {
  const resolved = await resolveRoomKeyHexForInviteDistribution(params);
  if (resolved.roomKeyHex) {
    return { roomKeyHex: resolved.roomKeyHex, source: resolved.source as InviteDistributionRoomKeySource };
  }
  const generated = (await params.generateRoomKey()).trim();
  const store = params.store ?? roomKeyStore;
  await store.saveRoomKey(params.groupId, generated);
  logAppEvent({
    name: "groups.coordination_room_key_invite_generated",
    level: "info",
    scope: { feature: "groups", action: "invite_room_key_generate" },
    context: {
      groupId: params.groupId,
      communityId: params.communityId ?? "",
      owner: COMMUNITY_COORDINATION_ROOM_KEY_OWNER_ID,
    },
  });
  return { roomKeyHex: generated, source: "generated" };
};

/** Best-effort steward wrap for an active member (C5 invite path). Does not throw. */
export const publishStewardCoordinationRoomKeyWrapForMember = async (params: Readonly<{
  communityId: string;
  groupId: string;
  roomKeyHex: string;
  subjectPubkey: PublicKeyHex;
  stewardPubkey: PublicKeyHex;
  stewardPrivateKeyHex: PrivateKeyHex;
}>): Promise<Readonly<
  { ok: true; wrapSeq: number }
  | { ok: false; skipped: true; error: string }
  | { ok: false; skipped: false; error: string }
>> => {
  const communityId = params.communityId.trim();
  if (!communityId || !isCoordinationConfigured()) {
    return { ok: false, skipped: true, error: "coordination_not_configured" };
  }
  const roomKeyHex = params.roomKeyHex.trim();
  if (!roomKeyHex) {
    return { ok: false, skipped: true, error: "room_key_missing" };
  }

  const result = await publishCoordinationRoomKeyWrap({
    communityId,
    groupId: params.groupId,
    roomKeyHex,
    subjectPubkey: params.subjectPubkey,
    actorPubkey: params.stewardPubkey,
    actorPrivateKeyHex: params.stewardPrivateKeyHex,
  });

  if (result.success) {
    logAppEvent({
      name: "groups.coordination_room_key_wrap_published",
      level: "info",
      scope: { feature: "groups", action: "coordination_room_key_steward_wrap" },
      context: {
        communityId,
        groupId: params.groupId,
        wrapSeq: result.wrapSeq,
        subjectPubkeySuffix: params.subjectPubkey.slice(-8),
        owner: COMMUNITY_COORDINATION_ROOM_KEY_OWNER_ID,
      },
    });
    return { ok: true, wrapSeq: result.wrapSeq };
  }

  logAppEvent({
    name: "groups.coordination_room_key_wrap_publish_failed",
    level: "warn",
    scope: { feature: "groups", action: "coordination_room_key_steward_wrap" },
    context: {
      communityId,
      groupId: params.groupId,
      subjectPubkeySuffix: params.subjectPubkey.slice(-8),
      error: result.errorMessage,
      owner: COMMUNITY_COORDINATION_ROOM_KEY_OWNER_ID,
    },
  });
  return { ok: false, skipped: false, error: result.errorMessage };
};

export const publishStewardCoordinationRoomKeyWrapsForInvitees = async (params: Readonly<{
  communityId?: string;
  groupId: string;
  roomKeyHex: string;
  stewardPubkey: PublicKeyHex;
  stewardPrivateKeyHex: PrivateKeyHex;
  inviteePubkeys: ReadonlyArray<PublicKeyHex>;
}>): Promise<void> => {
  const communityId = params.communityId?.trim();
  if (!communityId || params.inviteePubkeys.length === 0) {
    return;
  }
  await Promise.all(params.inviteePubkeys.map((subjectPubkey) => (
    publishStewardCoordinationRoomKeyWrapForMember({
      communityId,
      groupId: params.groupId,
      roomKeyHex: params.roomKeyHex,
      subjectPubkey,
      stewardPubkey: params.stewardPubkey,
      stewardPrivateKeyHex: params.stewardPrivateKeyHex,
    })
  )));
};
