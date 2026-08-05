/**
 * R-RELAY-RUST-6a — offline envelope pack schema (file sneakernet MVP).
 * Ciphertext-only; pack MAC is HMAC-SHA256 over canonical JSON excluding `packMac`.
 * @see specs/backend/r-relay-rust-6-offline-dtn-charter-2026-07.md
 */

import type { MeshAudience, MeshEnvelope, MeshEvidenceClass, MeshMessageScope } from "./envelope";
import { validateMeshEnvelope } from "./validate-envelope";

export const OBSCUR_OFFLINE_PACK_V1 = "obscur-offline-pack/v1" as const;

export type OfflinePackSchemaV1 = typeof OBSCUR_OFFLINE_PACK_V1;

/** Wire form of one envelope — ciphertext as base64 (no plaintext keys). */
export type OfflinePackEnvelopeWireV1 = Readonly<{
  envelopeId: string;
  correlationId?: string;
  profileId: string;
  messageScope: MeshMessageScope;
  audience: MeshAudience;
  ciphertextBase64: string;
  evidenceClass: MeshEvidenceClass;
  createdAtUnixMs: number;
  ttlMs?: number;
  priority?: "low" | "normal" | "high";
}>;

export type OfflinePackWireV1 = Readonly<{
  schema: OfflinePackSchemaV1;
  /** Non-secret label for humans / soft scope checks — not an auth token. */
  profileIdHint: string;
  createdAtUnixMs: number;
  expiresAtUnixMs?: number;
  envelopes: ReadonlyArray<OfflinePackEnvelopeWireV1>;
  /** Hex-encoded HMAC-SHA256 over canonical payload (fields except packMac). */
  packMac: string;
}>;

export type OfflinePackRejectReason =
  | "schema_invalid"
  | "pack_empty"
  | "envelope_invalid"
  | "ciphertext_empty"
  | "pack_mac_invalid"
  | "pack_expired"
  | "profile_scope_mismatch"
  | "created_at_invalid"
  | "pack_key_required"
  | "json_invalid";

export type OfflinePackDecodeResult =
  | Readonly<{ ok: true; pack: OfflinePackWireV1 }>
  | Readonly<{ ok: false; reason: OfflinePackRejectReason; detail?: string }>;

export type OfflinePackVerifyResult =
  | Readonly<{ ok: true; envelopes: ReadonlyArray<MeshEnvelope> }>
  | Readonly<{ ok: false; reason: OfflinePackRejectReason; detail?: string }>;

const textEncoder = new TextEncoder();

const bytesToHex = (bytes: Uint8Array): string => (
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
);

const hexToBytes = (hex: string): Uint8Array | null => {
  const trimmed = hex.trim().toLowerCase();
  if (!/^[0-9a-f]*$/.test(trimmed) || trimmed.length % 2 !== 0) {
    return null;
  }
  const out = new Uint8Array(trimmed.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(trimmed.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
};

const bytesToBase64 = (bytes: Uint8Array): string => {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
};

const base64ToBytes = (value: string): Uint8Array | null => {
  try {
    if (typeof Buffer !== "undefined") {
      return new Uint8Array(Buffer.from(value, "base64"));
    }
    const binary = atob(value);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      out[i] = binary.charCodeAt(i);
    }
    return out;
  } catch {
    return null;
  }
};

/** Stable JSON for MAC — key order fixed; excludes packMac. */
export const canonicalOfflinePackPayload = (
  pack: Omit<OfflinePackWireV1, "packMac">,
): string => (
  JSON.stringify({
    schema: pack.schema,
    profileIdHint: pack.profileIdHint,
    createdAtUnixMs: pack.createdAtUnixMs,
    expiresAtUnixMs: pack.expiresAtUnixMs ?? null,
    envelopes: pack.envelopes.map((env) => ({
      envelopeId: env.envelopeId,
      correlationId: env.correlationId ?? null,
      profileId: env.profileId,
      messageScope: env.messageScope,
      audience: env.audience,
      ciphertextBase64: env.ciphertextBase64,
      evidenceClass: env.evidenceClass,
      createdAtUnixMs: env.createdAtUnixMs,
      ttlMs: env.ttlMs ?? null,
      priority: env.priority ?? null,
    })),
  })
);

const hmacSha256Hex = async (key: Uint8Array, message: string): Promise<string> => {
  const subtle = globalThis.crypto?.subtle;
  if (subtle?.importKey && subtle.sign) {
    const cryptoKey = await subtle.importKey(
      "raw",
      key.slice(),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const mac = await subtle.sign("HMAC", cryptoKey, textEncoder.encode(message));
    return bytesToHex(new Uint8Array(mac));
  }

  // Node/vitest without SubtleCrypto — keep out of the webpack graph
  // (static `import("node:crypto")` breaks Next/webpack UnhandledSchemeError).
  try {
    const nodeCrypto = await import(
      /* webpackIgnore: true */
      "node:crypto"
    );
    return nodeCrypto.createHmac("sha256", Buffer.from(key)).update(message, "utf8").digest("hex");
  } catch {
    throw new Error("hmac_unavailable");
  }
};

export const envelopeToOfflineWire = (envelope: MeshEnvelope): OfflinePackEnvelopeWireV1 => ({
  envelopeId: envelope.envelopeId,
  ...(envelope.correlationId ? { correlationId: envelope.correlationId } : {}),
  profileId: envelope.scope.profileId,
  messageScope: envelope.messageScope,
  audience: envelope.audience,
  ciphertextBase64: bytesToBase64(envelope.ciphertext),
  evidenceClass: envelope.evidenceClass,
  createdAtUnixMs: envelope.createdAtUnixMs,
  ...(envelope.ttlMs !== undefined ? { ttlMs: envelope.ttlMs } : {}),
  ...(envelope.priority ? { priority: envelope.priority } : {}),
});

export const offlineWireToEnvelope = (
  wire: OfflinePackEnvelopeWireV1,
): MeshEnvelope | null => {
  const ciphertext = base64ToBytes(wire.ciphertextBase64);
  if (!ciphertext || ciphertext.byteLength === 0) {
    return null;
  }
  return {
    envelopeId: wire.envelopeId,
    ...(wire.correlationId ? { correlationId: wire.correlationId } : {}),
    scope: { profileId: wire.profileId },
    messageScope: wire.messageScope,
    audience: wire.audience,
    ciphertext,
    evidenceClass: wire.evidenceClass,
    createdAtUnixMs: wire.createdAtUnixMs,
    ...(wire.ttlMs !== undefined ? { ttlMs: wire.ttlMs } : {}),
    ...(wire.priority ? { priority: wire.priority } : {}),
  };
};

export type EncodeOfflinePackParams = Readonly<{
  profileIdHint: string;
  envelopes: ReadonlyArray<MeshEnvelope>;
  packKey: Uint8Array;
  createdAtUnixMs?: number;
  expiresAtUnixMs?: number;
}>;

export const encodeOfflinePack = async (
  params: EncodeOfflinePackParams,
): Promise<OfflinePackDecodeResult> => {
  if (params.packKey.byteLength === 0) {
    return { ok: false, reason: "pack_key_required" };
  }
  if (params.envelopes.length === 0) {
    return { ok: false, reason: "pack_empty" };
  }
  const createdAtUnixMs = params.createdAtUnixMs ?? Date.now();
  if (createdAtUnixMs <= 0) {
    return { ok: false, reason: "created_at_invalid" };
  }

  const wires: OfflinePackEnvelopeWireV1[] = [];
  for (const envelope of params.envelopes) {
    const validated = validateMeshEnvelope(envelope);
    if (!validated.ok) {
      return { ok: false, reason: "envelope_invalid", detail: validated.reason };
    }
    if (envelope.ciphertext.byteLength === 0) {
      return { ok: false, reason: "ciphertext_empty" };
    }
    wires.push(envelopeToOfflineWire(envelope));
  }

  const unsigned: Omit<OfflinePackWireV1, "packMac"> = {
    schema: OBSCUR_OFFLINE_PACK_V1,
    profileIdHint: params.profileIdHint.trim(),
    createdAtUnixMs,
    ...(params.expiresAtUnixMs !== undefined
      ? { expiresAtUnixMs: params.expiresAtUnixMs }
      : {}),
    envelopes: wires,
  };
  if (!unsigned.profileIdHint) {
    return { ok: false, reason: "profile_scope_mismatch", detail: "profile_id_hint_required" };
  }

  const packMac = await hmacSha256Hex(
    params.packKey,
    canonicalOfflinePackPayload(unsigned),
  );
  return { ok: true, pack: { ...unsigned, packMac } };
};

export const parseOfflinePackJson = (raw: string): OfflinePackDecodeResult => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return { ok: false, reason: "json_invalid" };
  }
  return decodeOfflinePack(parsed);
};

export const decodeOfflinePack = (value: unknown): OfflinePackDecodeResult => {
  if (!value || typeof value !== "object") {
    return { ok: false, reason: "schema_invalid" };
  }
  const record = value as Record<string, unknown>;
  if (record.schema !== OBSCUR_OFFLINE_PACK_V1) {
    return { ok: false, reason: "schema_invalid" };
  }
  if (typeof record.profileIdHint !== "string" || !record.profileIdHint.trim()) {
    return { ok: false, reason: "profile_scope_mismatch", detail: "profile_id_hint_required" };
  }
  if (typeof record.createdAtUnixMs !== "number" || record.createdAtUnixMs <= 0) {
    return { ok: false, reason: "created_at_invalid" };
  }
  if (record.expiresAtUnixMs !== undefined && typeof record.expiresAtUnixMs !== "number") {
    return { ok: false, reason: "schema_invalid", detail: "expires_at_invalid" };
  }
  if (!Array.isArray(record.envelopes) || record.envelopes.length === 0) {
    return { ok: false, reason: "pack_empty" };
  }
  if (typeof record.packMac !== "string" || !hexToBytes(record.packMac)) {
    return { ok: false, reason: "pack_mac_invalid" };
  }

  const envelopes: OfflinePackEnvelopeWireV1[] = [];
  for (const item of record.envelopes) {
    if (!item || typeof item !== "object") {
      return { ok: false, reason: "envelope_invalid" };
    }
    const env = item as Record<string, unknown>;
    if (typeof env.envelopeId !== "string" || !env.envelopeId.trim()) {
      return { ok: false, reason: "envelope_invalid", detail: "envelope_id_required" };
    }
    if (typeof env.profileId !== "string" || !env.profileId.trim()) {
      return { ok: false, reason: "envelope_invalid", detail: "profile_id_required" };
    }
    if (typeof env.ciphertextBase64 !== "string" || !env.ciphertextBase64.trim()) {
      return { ok: false, reason: "ciphertext_empty" };
    }
    if (typeof env.messageScope !== "string" || typeof env.evidenceClass !== "string") {
      return { ok: false, reason: "envelope_invalid" };
    }
    if (typeof env.createdAtUnixMs !== "number" || env.createdAtUnixMs <= 0) {
      return { ok: false, reason: "created_at_invalid" };
    }
    if (!env.audience || typeof env.audience !== "object") {
      return { ok: false, reason: "envelope_invalid", detail: "audience_required" };
    }
    envelopes.push({
      envelopeId: env.envelopeId,
      ...(typeof env.correlationId === "string" ? { correlationId: env.correlationId } : {}),
      profileId: env.profileId,
      messageScope: env.messageScope as MeshMessageScope,
      audience: env.audience as MeshAudience,
      ciphertextBase64: env.ciphertextBase64,
      evidenceClass: env.evidenceClass as MeshEvidenceClass,
      createdAtUnixMs: env.createdAtUnixMs,
      ...(typeof env.ttlMs === "number" ? { ttlMs: env.ttlMs } : {}),
      ...(env.priority === "low" || env.priority === "normal" || env.priority === "high"
        ? { priority: env.priority }
        : {}),
    });
  }

  return {
    ok: true,
    pack: {
      schema: OBSCUR_OFFLINE_PACK_V1,
      profileIdHint: record.profileIdHint.trim(),
      createdAtUnixMs: record.createdAtUnixMs,
      ...(typeof record.expiresAtUnixMs === "number"
        ? { expiresAtUnixMs: record.expiresAtUnixMs }
        : {}),
      envelopes,
      packMac: (record.packMac as string).trim().toLowerCase(),
    },
  };
};

export type VerifyOfflinePackParams = Readonly<{
  pack: OfflinePackWireV1;
  packKey: Uint8Array;
  /** Importing profile — must match hint and every envelope scope. */
  profileId: string;
  nowUnixMs?: number;
}>;

/**
 * Verify MAC, expiry, and profile scope; return MeshEnvelopes for persist (6b).
 */
export const verifyOfflinePackForImport = async (
  params: VerifyOfflinePackParams,
): Promise<OfflinePackVerifyResult> => {
  if (params.packKey.byteLength === 0) {
    return { ok: false, reason: "pack_key_required" };
  }
  const profileId = params.profileId.trim();
  if (!profileId) {
    return { ok: false, reason: "profile_scope_mismatch", detail: "profile_id_required" };
  }
  if (params.pack.profileIdHint.trim() !== profileId) {
    return { ok: false, reason: "profile_scope_mismatch", detail: "hint_mismatch" };
  }

  const now = params.nowUnixMs ?? Date.now();
  if (
    params.pack.expiresAtUnixMs !== undefined
    && params.pack.expiresAtUnixMs > 0
    && now > params.pack.expiresAtUnixMs
  ) {
    return { ok: false, reason: "pack_expired" };
  }

  const { packMac: _omit, ...unsigned } = params.pack;
  const expected = await hmacSha256Hex(
    params.packKey,
    canonicalOfflinePackPayload(unsigned),
  );
  if (expected !== params.pack.packMac.trim().toLowerCase()) {
    return { ok: false, reason: "pack_mac_invalid" };
  }

  const envelopes: MeshEnvelope[] = [];
  for (const wire of params.pack.envelopes) {
    if (wire.profileId.trim() !== profileId) {
      return { ok: false, reason: "profile_scope_mismatch", detail: "envelope_profile_mismatch" };
    }
    const envelope = offlineWireToEnvelope(wire);
    if (!envelope) {
      return { ok: false, reason: "ciphertext_empty" };
    }
    const validated = validateMeshEnvelope(envelope);
    if (!validated.ok) {
      return { ok: false, reason: "envelope_invalid", detail: validated.reason };
    }
    envelopes.push(envelope);
  }
  if (envelopes.length === 0) {
    return { ok: false, reason: "pack_empty" };
  }
  return { ok: true, envelopes };
};
