/**
 * R-RELAY-RUST-6d — build/invoke offline pack export/import (USB / file helper).
 * Explicit profileId — no ambient current-user.
 * @see specs/frontend/r-relay-rust-6d-offline-ux-spec-2026-07.md
 */

import type { EngineInvokeRequest, EngineInvokeResult, HostEnginePort } from "@obscur/engine-contracts";
import {
  createTauriEngineHost,
  isTauriEngineHostAvailable,
} from "@obscur/engine-host/tauri";

export const OFFLINE_PACK_FILE_SUFFIX = ".obscur-offline-pack.json";

export type OfflinePackEnvelopeWireInput = Readonly<{
  envelopeId: string;
  profileId: string;
  messageScope?: "dm" | "workspace" | "control";
  audience?: Readonly<{ kind: "dm"; recipientPublicKeyHex: string }>;
  ciphertextBase64: string;
  evidenceClass?: "accepted_when_imported";
  createdAtUnixMs?: number;
}>;

export const isAllowedOfflinePackPath = (path: string): boolean => {
  const trimmed = path.trim().toLowerCase();
  if (!trimmed) {
    return false;
  }
  return trimmed.endsWith(OFFLINE_PACK_FILE_SUFFIX) || trimmed.endsWith(".json");
};

export const buildLabOfflineEnvelopeWire = (
  params: OfflinePackEnvelopeWireInput,
): Readonly<Record<string, unknown>> => {
  const profileId = params.profileId.trim();
  const envelopeId = params.envelopeId.trim() || `env-offline-${Date.now()}`;
  return {
    envelopeId,
    profileId,
    messageScope: params.messageScope ?? "dm",
    audience: params.audience ?? {
      kind: "dm",
      recipientPublicKeyHex: "offline-recipient",
    },
    ciphertextBase64: params.ciphertextBase64,
    evidenceClass: params.evidenceClass ?? "accepted_when_imported",
    createdAtUnixMs: params.createdAtUnixMs ?? Date.now(),
  };
};

export const buildExportOfflinePackRequest = (params: Readonly<{
  profileId: string;
  packKeyHex: string;
  envelopes: ReadonlyArray<Record<string, unknown>>;
  filePath?: string;
  fileName?: string;
  expiresAtUnixMs?: number;
}>): EngineInvokeRequest => ({
  engine: "transport",
  method: "exportOfflinePack",
  scope: { profileId: params.profileId.trim() },
  payload: {
    envelopes: params.envelopes,
    packKeyHex: params.packKeyHex.trim().toLowerCase(),
    ...(params.filePath?.trim() ? { filePath: params.filePath.trim() } : {}),
    ...(params.fileName?.trim() ? { fileName: params.fileName.trim() } : {}),
    ...(params.expiresAtUnixMs !== undefined
      ? { expiresAtUnixMs: params.expiresAtUnixMs }
      : {}),
  },
});

export const buildImportOfflinePackRequest = (params: Readonly<{
  profileId: string;
  packKeyHex: string;
  filePath: string;
  persistToDm?: boolean;
}>): EngineInvokeRequest => ({
  engine: "transport",
  method: "importOfflinePack",
  scope: { profileId: params.profileId.trim() },
  payload: {
    filePath: params.filePath.trim(),
    packKeyHex: params.packKeyHex.trim().toLowerCase(),
    persistToDm: params.persistToDm === true,
  },
});

export type OfflinePackHostResult = Readonly<{
  attempted: boolean;
  ok: boolean;
  errorMessage?: string;
  data?: unknown;
}>;

const mapInvoke = (result: EngineInvokeResult): OfflinePackHostResult => {
  if (!result.ok) {
    return {
      attempted: true,
      ok: false,
      errorMessage: result.errorMessage ?? result.errorCode ?? "invoke_failed",
      data: result.data,
    };
  }
  const data = result.data as { ok?: boolean; rejectReason?: string } | undefined;
  if (data && data.ok === false) {
    return {
      attempted: true,
      ok: false,
      errorMessage: data.rejectReason ?? "offline_pack_rejected",
      data: result.data,
    };
  }
  return { attempted: true, ok: true, data: result.data };
};

export const exportOfflinePackViaHost = async (params: Readonly<{
  profileId: string;
  packKeyHex: string;
  envelopes: ReadonlyArray<Record<string, unknown>>;
  filePath?: string;
  fileName?: string;
  expiresAtUnixMs?: number;
  host?: HostEnginePort;
}>): Promise<OfflinePackHostResult> => {
  const profileId = params.profileId.trim();
  if (!profileId) {
    return { attempted: false, ok: false, errorMessage: "missing_profile_id" };
  }
  if (!params.packKeyHex.trim()) {
    return { attempted: false, ok: false, errorMessage: "pack_key_required" };
  }
  if (params.envelopes.length === 0) {
    return { attempted: false, ok: false, errorMessage: "pack_empty" };
  }
  const pathOrName = params.filePath?.trim() || params.fileName?.trim();
  if (pathOrName && params.filePath?.trim() && !isAllowedOfflinePackPath(params.filePath)) {
    return { attempted: false, ok: false, errorMessage: "invalid_pack_path" };
  }
  if (!params.host && !isTauriEngineHostAvailable()) {
    return { attempted: false, ok: false, errorMessage: "desktop_required" };
  }
  const host = params.host ?? createTauriEngineHost();
  try {
    const result = await host.invoke(buildExportOfflinePackRequest(params));
    return mapInvoke(result);
  } catch (error) {
    return {
      attempted: true,
      ok: false,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
};

export const importOfflinePackViaHost = async (params: Readonly<{
  profileId: string;
  packKeyHex: string;
  filePath: string;
  persistToDm?: boolean;
  host?: HostEnginePort;
}>): Promise<OfflinePackHostResult> => {
  const profileId = params.profileId.trim();
  if (!profileId) {
    return { attempted: false, ok: false, errorMessage: "missing_profile_id" };
  }
  if (!params.packKeyHex.trim()) {
    return { attempted: false, ok: false, errorMessage: "pack_key_required" };
  }
  if (!isAllowedOfflinePackPath(params.filePath)) {
    return { attempted: false, ok: false, errorMessage: "invalid_pack_path" };
  }
  if (!params.host && !isTauriEngineHostAvailable()) {
    return { attempted: false, ok: false, errorMessage: "desktop_required" };
  }
  const host = params.host ?? createTauriEngineHost();
  try {
    const result = await host.invoke(buildImportOfflinePackRequest(params));
    return mapInvoke(result);
  } catch (error) {
    return {
      attempted: true,
      ok: false,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
};
