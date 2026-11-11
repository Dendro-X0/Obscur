/**
 * Cut 10.1 — Continuity M4 device-transfer offer (clipboard/sneakernet carrier).
 * Wraps Cut 8 sealed Continuity M1 — transfer code ≠ Continuity passphrase.
 * ≠ Continuity Pass · Soft L3 paused.
 * @see specs/backend/cut10-continuity-m4-device-transfer-design-2026-11-10.md
 */

import {
  CONTINUITY_M1_SEALED_FORMAT,
  parseContinuityM1SealedEnvelope,
} from "./continuity-m1-snapshot";

export const CONTINUITY_M4_OFFER_FORMAT = "obscur.continuity_m4.offer.v1" as const;

/** Default offer lifetime — NARROW C2. */
export const CONTINUITY_M4_OFFER_TTL_MS = 15 * 60 * 1000;

export type ContinuityM4Offer = Readonly<{
  version: 1;
  format: typeof CONTINUITY_M4_OFFER_FORMAT;
  transferCode: string;
  publicKeyHexHint?: string;
  sealedEnvelopeJson: string;
  createdAtUnixMs: number;
  expiresAtUnixMs: number;
}>;

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === "object" && value !== null
);

const normalizeTransferCode = (value: string): string => value.trim().replace(/\s+/g, "");

export const generateContinuityM4TransferCode = (
  random: () => number = Math.random,
): string => {
  const n = Math.floor(random() * 1_000_000);
  return String(n).padStart(6, "0");
};

export const createContinuityM4Offer = (params: Readonly<{
  sealedEnvelopeJson: string;
  publicKeyHexHint?: string;
  transferCode?: string;
  nowUnixMs?: number;
  ttlMs?: number;
}>): ContinuityM4Offer => {
  const sealedEnvelopeJson = params.sealedEnvelopeJson.trim();
  if (!sealedEnvelopeJson) {
    throw new Error("Sealed Continuity envelope required for M4 offer");
  }
  const parsed = parseContinuityM1SealedEnvelope(
    (() => {
      try {
        return JSON.parse(sealedEnvelopeJson) as unknown;
      } catch {
        return null;
      }
    })(),
  );
  if (!parsed || parsed.format !== CONTINUITY_M1_SEALED_FORMAT) {
    throw new Error("M4 offer requires a sealed Continuity M1 envelope");
  }
  const createdAtUnixMs = params.nowUnixMs ?? Date.now();
  const ttlMs = params.ttlMs ?? CONTINUITY_M4_OFFER_TTL_MS;
  return {
    version: 1,
    format: CONTINUITY_M4_OFFER_FORMAT,
    transferCode: normalizeTransferCode(params.transferCode ?? generateContinuityM4TransferCode()),
    publicKeyHexHint: params.publicKeyHexHint?.trim() || parsed.publicKeyHexHint,
    sealedEnvelopeJson,
    createdAtUnixMs,
    expiresAtUnixMs: createdAtUnixMs + ttlMs,
  };
};

export const parseContinuityM4Offer = (value: unknown): ContinuityM4Offer | null => {
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
  if (raw.version !== 1 || raw.format !== CONTINUITY_M4_OFFER_FORMAT) {
    return null;
  }
  if (
    typeof raw.transferCode !== "string"
    || typeof raw.sealedEnvelopeJson !== "string"
    || typeof raw.createdAtUnixMs !== "number"
    || typeof raw.expiresAtUnixMs !== "number"
  ) {
    return null;
  }
  return {
    version: 1,
    format: CONTINUITY_M4_OFFER_FORMAT,
    transferCode: normalizeTransferCode(raw.transferCode),
    publicKeyHexHint: typeof raw.publicKeyHexHint === "string" ? raw.publicKeyHexHint : undefined,
    sealedEnvelopeJson: raw.sealedEnvelopeJson,
    createdAtUnixMs: raw.createdAtUnixMs,
    expiresAtUnixMs: raw.expiresAtUnixMs,
  };
};

export type ContinuityM4OfferVerifyResult = Readonly<{
  ok: true;
  offer: ContinuityM4Offer;
} | {
  ok: false;
  reasonCode: "invalid_offer" | "expired" | "wrong_code";
  error: string;
}>;

export const verifyContinuityM4Offer = (params: Readonly<{
  offer: ContinuityM4Offer | string | unknown;
  transferCode: string;
  nowUnixMs?: number;
}>): ContinuityM4OfferVerifyResult => {
  const offer = parseContinuityM4Offer(params.offer);
  if (!offer) {
    return {
      ok: false,
      reasonCode: "invalid_offer",
      error: "Invalid Continuity M4 transfer offer",
    };
  }
  const now = params.nowUnixMs ?? Date.now();
  if (now > offer.expiresAtUnixMs) {
    return {
      ok: false,
      reasonCode: "expired",
      error: "Continuity M4 transfer offer expired",
    };
  }
  if (normalizeTransferCode(params.transferCode) !== offer.transferCode) {
    return {
      ok: false,
      reasonCode: "wrong_code",
      error: "Incorrect Continuity M4 transfer code",
    };
  }
  return { ok: true, offer };
};

export const serializeContinuityM4Offer = (offer: ContinuityM4Offer): string => (
  JSON.stringify(offer, null, 2)
);
