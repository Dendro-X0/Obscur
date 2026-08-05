/**
 * R-RELAY-RUST-6d — QR chunk encode/decode for offline pack JSON (no camera / no BLE).
 * @see specs/frontend/r-relay-rust-6d-offline-ux-spec-2026-07.md
 */

export const OBSCUR_OFFLINE_QR_V1 = "obscur-offline-qr/v1" as const;

/** Conservative payload size for common QR versions (UTF-8 chars). */
export const OFFLINE_QR_DEFAULT_CHUNK_CHARS = 800;

export type OfflineQrChunkV1 = Readonly<{
  schema: typeof OBSCUR_OFFLINE_QR_V1;
  /** First 8 hex chars of packMac (or hash prefix) for reassembly guard. */
  packMacPrefix: string;
  index: number;
  total: number;
  payload: string;
}>;

export type OfflineQrChunkRejectReason =
  | "schema_invalid"
  | "chunk_empty"
  | "index_invalid"
  | "prefix_mismatch"
  | "incomplete"
  | "json_invalid";

const extractPackMacPrefix = (packJson: string): string => {
  try {
    const parsed = JSON.parse(packJson) as { packMac?: unknown };
    if (typeof parsed.packMac === "string" && parsed.packMac.trim().length >= 8) {
      return parsed.packMac.trim().toLowerCase().slice(0, 8);
    }
  } catch {
    // fall through
  }
  let hash = 0;
  for (let i = 0; i < packJson.length; i += 1) {
    hash = ((hash << 5) - hash + packJson.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, "0").slice(0, 8);
};

export const chunkOfflinePackJson = (
  packJson: string,
  chunkChars: number = OFFLINE_QR_DEFAULT_CHUNK_CHARS,
): ReadonlyArray<OfflineQrChunkV1> => {
  const raw = packJson.trim();
  if (!raw) {
    return [];
  }
  const size = Math.max(64, Math.floor(chunkChars));
  const prefix = extractPackMacPrefix(raw);
  const total = Math.ceil(raw.length / size);
  const chunks: OfflineQrChunkV1[] = [];
  for (let index = 0; index < total; index += 1) {
    chunks.push({
      schema: OBSCUR_OFFLINE_QR_V1,
      packMacPrefix: prefix,
      index,
      total,
      payload: raw.slice(index * size, (index + 1) * size),
    });
  }
  return chunks;
};

export const parseOfflineQrChunkJson = (
  raw: string,
): Readonly<{ ok: true; chunk: OfflineQrChunkV1 } | { ok: false; reason: OfflineQrChunkRejectReason }> => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return { ok: false, reason: "json_invalid" };
  }
  if (!parsed || typeof parsed !== "object") {
    return { ok: false, reason: "schema_invalid" };
  }
  const record = parsed as Record<string, unknown>;
  if (record.schema !== OBSCUR_OFFLINE_QR_V1) {
    return { ok: false, reason: "schema_invalid" };
  }
  if (typeof record.packMacPrefix !== "string" || record.packMacPrefix.trim().length < 4) {
    return { ok: false, reason: "schema_invalid" };
  }
  if (typeof record.index !== "number" || typeof record.total !== "number") {
    return { ok: false, reason: "index_invalid" };
  }
  if (record.index < 0 || record.total < 1 || record.index >= record.total) {
    return { ok: false, reason: "index_invalid" };
  }
  if (typeof record.payload !== "string" || record.payload.length === 0) {
    return { ok: false, reason: "chunk_empty" };
  }
  return {
    ok: true,
    chunk: {
      schema: OBSCUR_OFFLINE_QR_V1,
      packMacPrefix: record.packMacPrefix.trim().toLowerCase(),
      index: record.index,
      total: record.total,
      payload: record.payload,
    },
  };
};

export const assembleOfflinePackJson = (
  chunks: ReadonlyArray<OfflineQrChunkV1>,
): Readonly<{ ok: true; packJson: string } | { ok: false; reason: OfflineQrChunkRejectReason }> => {
  if (chunks.length === 0) {
    return { ok: false, reason: "incomplete" };
  }
  const total = chunks[0]?.total ?? 0;
  const prefix = chunks[0]?.packMacPrefix ?? "";
  if (total < 1 || chunks.length !== total) {
    return { ok: false, reason: "incomplete" };
  }
  const ordered = [...chunks].sort((a, b) => a.index - b.index);
  for (let i = 0; i < total; i += 1) {
    const chunk = ordered[i];
    if (!chunk || chunk.index !== i || chunk.total !== total) {
      return { ok: false, reason: "incomplete" };
    }
    if (chunk.packMacPrefix !== prefix) {
      return { ok: false, reason: "prefix_mismatch" };
    }
    if (chunk.schema !== OBSCUR_OFFLINE_QR_V1) {
      return { ok: false, reason: "schema_invalid" };
    }
  }
  return { ok: true, packJson: ordered.map((c) => c.payload).join("") };
};
