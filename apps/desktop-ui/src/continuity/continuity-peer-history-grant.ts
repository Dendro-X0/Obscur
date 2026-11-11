/**
 * Cut 15.1 — Continuity peer history grants (Ingredient 5 NARROW).
 * Opaque residue only · ≠ invent CRM · ≠ Continuity Pass · Soft L3 paused.
 * @see specs/backend/cut15-continuity-peer-history-grants-design-2026-11-10.md
 */

export const CONTINUITY_PEER_GRANT_FORMAT = "obscur.continuity_peer_grant.v1" as const;
export const CONTINUITY_PEER_GRANT_TTL_MS = 24 * 60 * 60 * 1000;
export const CONTINUITY_PEER_GRANT_STORAGE_PREFIX = "obscur.continuity.peer_grants.v1";

export type ContinuityPeerHistoryGrantOffer = Readonly<{
  version: 1;
  format: typeof CONTINUITY_PEER_GRANT_FORMAT;
  grantId: string;
  transferCode: string;
  recipientPublicKeyHex: string;
  grantorPublicKeyHexHint?: string;
  /** Opaque history residue JSON — not CRM / Soft L3 invent. */
  opaqueHistoryJson: string;
  honestyNote: "opaque_history_grant";
  createdAtUnixMs: number;
  expiresAtUnixMs: number;
}>;

export type ContinuityPeerHistoryGrantRecord = Readonly<{
  grantId: string;
  direction: "outgoing" | "incoming";
  recipientPublicKeyHex: string;
  grantorPublicKeyHexHint?: string;
  opaqueHistoryJson: string;
  honestyNote: "opaque_history_grant";
  createdAtUnixMs: number;
  acceptedAtUnixMs?: number;
  status: "offered" | "accepted" | "expired";
}>;

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === "object" && value !== null
);

const normalizeHex = (value: string): string => value.trim().toLowerCase();

const normalizeTransferCode = (value: string): string => value.trim().replace(/\s+/g, "");

export const generateContinuityPeerGrantCode = (
  random: () => number = Math.random,
): string => {
  const n = Math.floor(random() * 1_000_000);
  return String(n).padStart(6, "0");
};

export const generateContinuityPeerGrantId = (
  randomUuid: () => string = () => crypto.randomUUID(),
): string => randomUuid();

export const buildOpaquePeerHistoryJson = (params?: Readonly<{
  envelopeIds?: ReadonlyArray<string>;
  note?: string;
}>): string => (
  JSON.stringify({
    honestyNote: "opaque_history_grant",
    envelopeIds: params?.envelopeIds ? [...params.envelopeIds] : [],
    note: params?.note ?? "Peer history residue — ≠ invent CRM · ≠ Continuity Pass",
  })
);

export const createContinuityPeerHistoryGrantOffer = (params: Readonly<{
  recipientPublicKeyHex: string;
  grantorPublicKeyHexHint?: string;
  opaqueHistoryJson?: string;
  transferCode?: string;
  grantId?: string;
  nowUnixMs?: number;
  ttlMs?: number;
}>): ContinuityPeerHistoryGrantOffer => {
  const recipientPublicKeyHex = normalizeHex(params.recipientPublicKeyHex);
  if (!recipientPublicKeyHex || recipientPublicKeyHex.length < 16) {
    throw new Error("Recipient public key required for peer history grant");
  }
  const createdAtUnixMs = params.nowUnixMs ?? Date.now();
  const ttlMs = params.ttlMs ?? CONTINUITY_PEER_GRANT_TTL_MS;
  return {
    version: 1,
    format: CONTINUITY_PEER_GRANT_FORMAT,
    grantId: params.grantId ?? generateContinuityPeerGrantId(),
    transferCode: normalizeTransferCode(params.transferCode ?? generateContinuityPeerGrantCode()),
    recipientPublicKeyHex,
    grantorPublicKeyHexHint: params.grantorPublicKeyHexHint
      ? normalizeHex(params.grantorPublicKeyHexHint)
      : undefined,
    opaqueHistoryJson: params.opaqueHistoryJson?.trim() || buildOpaquePeerHistoryJson(),
    honestyNote: "opaque_history_grant",
    createdAtUnixMs,
    expiresAtUnixMs: createdAtUnixMs + ttlMs,
  };
};

export const parseContinuityPeerHistoryGrantOffer = (
  value: unknown,
): ContinuityPeerHistoryGrantOffer | null => {
  let raw: unknown = value;
  if (typeof value === "string") {
    try {
      raw = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!isRecord(raw)) {
    return null;
  }
  if (raw.version !== 1 || raw.format !== CONTINUITY_PEER_GRANT_FORMAT) {
    return null;
  }
  if (
    typeof raw.grantId !== "string"
    || typeof raw.transferCode !== "string"
    || typeof raw.recipientPublicKeyHex !== "string"
    || typeof raw.opaqueHistoryJson !== "string"
    || typeof raw.createdAtUnixMs !== "number"
    || typeof raw.expiresAtUnixMs !== "number"
    || raw.honestyNote !== "opaque_history_grant"
  ) {
    return null;
  }
  return {
    version: 1,
    format: CONTINUITY_PEER_GRANT_FORMAT,
    grantId: raw.grantId,
    transferCode: normalizeTransferCode(raw.transferCode),
    recipientPublicKeyHex: normalizeHex(raw.recipientPublicKeyHex),
    grantorPublicKeyHexHint: typeof raw.grantorPublicKeyHexHint === "string"
      ? normalizeHex(raw.grantorPublicKeyHexHint)
      : undefined,
    opaqueHistoryJson: raw.opaqueHistoryJson,
    honestyNote: "opaque_history_grant",
    createdAtUnixMs: raw.createdAtUnixMs,
    expiresAtUnixMs: raw.expiresAtUnixMs,
  };
};

export type ContinuityPeerGrantVerifyResult = Readonly<{
  ok: true;
  offer: ContinuityPeerHistoryGrantOffer;
} | {
  ok: false;
  reasonCode: "invalid_offer" | "expired" | "wrong_code" | "recipient_mismatch";
  error: string;
}>;

export const verifyContinuityPeerHistoryGrantOffer = (params: Readonly<{
  offer: ContinuityPeerHistoryGrantOffer | string | unknown;
  transferCode: string;
  expectedRecipientPublicKeyHex?: string;
  nowUnixMs?: number;
}>): ContinuityPeerGrantVerifyResult => {
  const offer = parseContinuityPeerHistoryGrantOffer(params.offer);
  if (!offer) {
    return {
      ok: false,
      reasonCode: "invalid_offer",
      error: "Invalid Continuity peer history grant offer",
    };
  }
  const now = params.nowUnixMs ?? Date.now();
  if (now > offer.expiresAtUnixMs) {
    return {
      ok: false,
      reasonCode: "expired",
      error: "Continuity peer history grant expired",
    };
  }
  if (normalizeTransferCode(params.transferCode) !== offer.transferCode) {
    return {
      ok: false,
      reasonCode: "wrong_code",
      error: "Incorrect Continuity peer history grant code",
    };
  }
  if (
    params.expectedRecipientPublicKeyHex
    && normalizeHex(params.expectedRecipientPublicKeyHex) !== offer.recipientPublicKeyHex
  ) {
    return {
      ok: false,
      reasonCode: "recipient_mismatch",
      error: "Peer history grant recipient pubkey mismatch",
    };
  }
  return { ok: true, offer };
};

export const serializeContinuityPeerHistoryGrantOffer = (
  offer: ContinuityPeerHistoryGrantOffer,
): string => JSON.stringify(offer, null, 2);

export const getContinuityPeerGrantStorageKey = (profileId: string): string => (
  `${CONTINUITY_PEER_GRANT_STORAGE_PREFIX}::${profileId}`
);

const parseGrantRecord = (value: unknown): ContinuityPeerHistoryGrantRecord | null => {
  if (!isRecord(value)) {
    return null;
  }
  if (
    typeof value.grantId !== "string"
    || (value.direction !== "outgoing" && value.direction !== "incoming")
    || typeof value.recipientPublicKeyHex !== "string"
    || typeof value.opaqueHistoryJson !== "string"
    || typeof value.createdAtUnixMs !== "number"
    || value.honestyNote !== "opaque_history_grant"
    || (value.status !== "offered" && value.status !== "accepted" && value.status !== "expired")
  ) {
    return null;
  }
  return {
    grantId: value.grantId,
    direction: value.direction,
    recipientPublicKeyHex: normalizeHex(value.recipientPublicKeyHex),
    grantorPublicKeyHexHint: typeof value.grantorPublicKeyHexHint === "string"
      ? normalizeHex(value.grantorPublicKeyHexHint)
      : undefined,
    opaqueHistoryJson: value.opaqueHistoryJson,
    honestyNote: "opaque_history_grant",
    createdAtUnixMs: value.createdAtUnixMs,
    acceptedAtUnixMs: typeof value.acceptedAtUnixMs === "number" ? value.acceptedAtUnixMs : undefined,
    status: value.status,
  };
};

export const readContinuityPeerHistoryGrants = (
  profileId: string,
): ReadonlyArray<ContinuityPeerHistoryGrantRecord> => {
  if (typeof window === "undefined") {
    return [];
  }
  const raw = window.localStorage.getItem(getContinuityPeerGrantStorageKey(profileId));
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map(parseGrantRecord)
      .filter((row): row is ContinuityPeerHistoryGrantRecord => row !== null);
  } catch {
    return [];
  }
};

export const writeContinuityPeerHistoryGrants = (
  profileId: string,
  grants: ReadonlyArray<ContinuityPeerHistoryGrantRecord>,
): void => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(
    getContinuityPeerGrantStorageKey(profileId),
    JSON.stringify(grants),
  );
};

export const recordOutgoingContinuityPeerHistoryGrant = (
  profileId: string,
  offer: ContinuityPeerHistoryGrantOffer,
): ContinuityPeerHistoryGrantRecord => {
  const record: ContinuityPeerHistoryGrantRecord = {
    grantId: offer.grantId,
    direction: "outgoing",
    recipientPublicKeyHex: offer.recipientPublicKeyHex,
    grantorPublicKeyHexHint: offer.grantorPublicKeyHexHint,
    opaqueHistoryJson: offer.opaqueHistoryJson,
    honestyNote: "opaque_history_grant",
    createdAtUnixMs: offer.createdAtUnixMs,
    status: "offered",
  };
  const existing = readContinuityPeerHistoryGrants(profileId)
    .filter((row) => row.grantId !== record.grantId);
  writeContinuityPeerHistoryGrants(profileId, [...existing, record]);
  return record;
};

/**
 * Accept stores opaque grant residue only — never invents Soft L3 trust / CRM edges.
 */
export type ContinuityPeerGrantAcceptStoreResult = Readonly<{
  ok: true;
  record: ContinuityPeerHistoryGrantRecord;
} | {
  ok: false;
  reasonCode: "invalid_offer" | "expired" | "wrong_code" | "recipient_mismatch";
  error: string;
}>;

export const acceptContinuityPeerHistoryGrant = (params: Readonly<{
  profileId: string;
  offer: ContinuityPeerHistoryGrantOffer | string | unknown;
  transferCode: string;
  expectedRecipientPublicKeyHex?: string;
  nowUnixMs?: number;
}>): ContinuityPeerGrantAcceptStoreResult => {
  const verified = verifyContinuityPeerHistoryGrantOffer({
    offer: params.offer,
    transferCode: params.transferCode,
    expectedRecipientPublicKeyHex: params.expectedRecipientPublicKeyHex,
    nowUnixMs: params.nowUnixMs,
  });
  if (!verified.ok) {
    return {
      ok: false,
      reasonCode: verified.reasonCode,
      error: verified.error,
    };
  }
  const now = params.nowUnixMs ?? Date.now();
  const record: ContinuityPeerHistoryGrantRecord = {
    grantId: verified.offer.grantId,
    direction: "incoming",
    recipientPublicKeyHex: verified.offer.recipientPublicKeyHex,
    grantorPublicKeyHexHint: verified.offer.grantorPublicKeyHexHint,
    opaqueHistoryJson: verified.offer.opaqueHistoryJson,
    honestyNote: "opaque_history_grant",
    createdAtUnixMs: verified.offer.createdAtUnixMs,
    acceptedAtUnixMs: now,
    status: "accepted",
  };
  const existing = readContinuityPeerHistoryGrants(params.profileId)
    .filter((row) => row.grantId !== record.grantId);
  writeContinuityPeerHistoryGrants(params.profileId, [...existing, record]);
  return { ok: true, record };
};
