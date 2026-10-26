/**
 * ACC-04 — Native voice call history owner (SQLite authority).
 *
 * In-memory call-state CRDT remains the live session owner; terminal calls are
 * mirrored into `call_records` for restart survival.
 */

import {
  isTauri,
  type CallRecord,
} from "@dweb/db";
import { listCallRecords, upsertCallRecord } from "@obscur/persistence-engine";
import { createTauriEngineHost } from "@obscur/engine-host/tauri";
import type { HostEnginePort } from "@obscur/engine-contracts";
import { requiresSqlitePersistence } from "@/app/features/runtime/native-persistence-policy";
import type { VoiceCallRoomRenderSummary } from "../components/message-list-render-meta";
import type { CallStatus } from "./call-state-crdt";

/** Match call-state-crdt DEFAULT_CALL_TTL_MS — keep type-only import to avoid pulling CRDT into the client graph. */
const TERMINAL_CALL_TTL_MS = 2 * 60 * 60 * 1000;

export type TerminalCallHint = "declined" | "ended" | "timeout";

let callPersistenceEngineHost: HostEnginePort | null = null;

const getCallPersistenceEngineHost = (): HostEnginePort => {
  callPersistenceEngineHost ??= createTauriEngineHost();
  return callPersistenceEngineHost;
};

const resolvePeerPubkey = (
  status: CallStatus,
  accountPublicKeyHex?: string,
): string => {
  if (accountPublicKeyHex) {
    const remote = status.participants.find((participant) => participant !== accountPublicKeyHex);
    if (remote) {
      return remote;
    }
  }
  if (status.initiatedBy) {
    const other = status.participants.find((participant) => participant !== status.initiatedBy);
    if (other) {
      return other;
    }
  }
  return status.participants[0] ?? status.initiatedBy ?? accountPublicKeyHex ?? "unknown";
};

export const mapTerminalCallStatusToSqliteStatus = (
  status: CallStatus,
  terminalHint?: TerminalCallHint,
): string => {
  if (terminalHint === "declined") {
    return "declined";
  }
  if (status.isExpired || terminalHint === "timeout") {
    return "timeout";
  }
  if (status.state === "ended" && status.activeCount === 0 && status.endedAt && !status.startedAt) {
    return "missed";
  }
  if (status.startedAt && status.endedAt && status.activeCount === 0) {
    return "answered";
  }
  return "ended";
};

export const buildTerminalCallRecord = (params: Readonly<{
  profileId: string;
  status: CallStatus;
  accountPublicKeyHex?: string;
  terminalHint?: TerminalCallHint;
}>): CallRecord | null => {
  if (params.status.state !== "ended" && params.status.state !== "expired") {
    return null;
  }

  const startedAt = params.status.startedAt;
  // Never stamp wall-clock now for expired calls — that rewrote history ENDED to app-open time.
  const endedAt = params.status.endedAt
    ?? (params.status.isExpired && startedAt != null
      ? startedAt + TERMINAL_CALL_TTL_MS
      : null);
  const durationMs = startedAt && endedAt ? Math.max(0, endedAt - startedAt) : null;

  return {
    call_id: params.status.callId,
    profile_id: params.profileId,
    peer_pubkey: resolvePeerPubkey(params.status, params.accountPublicKeyHex),
    initiated_by: params.status.initiatedBy ?? params.accountPublicKeyHex ?? "unknown",
    status: mapTerminalCallStatusToSqliteStatus(params.status, params.terminalHint),
    started_at: startedAt,
    ended_at: endedAt,
    duration_ms: durationMs,
  };
};

export const upsertTerminalCallRecord = async (record: CallRecord): Promise<void> => {
  if (!requiresSqlitePersistence() || !isTauri()) {
    return;
  }
  await upsertCallRecord({
    host: getCallPersistenceEngineHost(),
    profileId: record.profile_id,
    record,
  }).catch(() => undefined);
};

export const persistTerminalCallRecordFromStatus = async (params: Readonly<{
  profileId: string;
  status: CallStatus;
  accountPublicKeyHex?: string;
  terminalHint?: TerminalCallHint;
}>): Promise<boolean> => {
  const record = buildTerminalCallRecord(params);
  if (!record) {
    return false;
  }
  await upsertTerminalCallRecord(record);
  return true;
};

export const loadSqliteCallRecords = async (
  profileId: string,
): Promise<ReadonlyArray<CallRecord>> => {
  if (!requiresSqlitePersistence() || !isTauri()) {
    return [];
  }
  try {
    return await listCallRecords({
      host: getCallPersistenceEngineHost(),
      profileId,
    });
  } catch {
    return [];
  }
};

export const mapCallRecordToVoiceCallRoomSummary = (
  record: CallRecord,
): VoiceCallRoomRenderSummary => {
  // Only an answered call is a completed connection. Bare "ended" / timeout / missed
  // must not paint CALL COMPLETED with a synthetic duration (startup ghost-call).
  const connectedAtUnixMs = record.status === "answered"
    ? record.started_at
    : null;
  const endedAtUnixMs = record.ended_at;
  const endedNormally = record.status === "answered"
    && connectedAtUnixMs !== null
    && endedAtUnixMs !== null;
  const durationSeconds = endedNormally && typeof record.duration_ms === "number"
    ? Math.max(0, Math.floor(record.duration_ms / 1000))
    : (endedNormally && connectedAtUnixMs !== null && endedAtUnixMs !== null
      ? Math.max(0, Math.floor((endedAtUnixMs - connectedAtUnixMs) / 1000))
      : null);

  return {
    roomId: record.call_id,
    invitedAtUnixMs: record.started_at ?? endedAtUnixMs,
    expiresAtUnixMs: null,
    connectedAtUnixMs,
    endedAtUnixMs,
    endedNormally,
    durationSeconds,
  };
};

/** Prefer sqlite terminal evidence when DM timeline rows are incomplete after restart. */
export const mergeVoiceCallRoomSummaries = (
  fromMessages: VoiceCallRoomRenderSummary | null,
  fromSqlite: VoiceCallRoomRenderSummary | null,
): VoiceCallRoomRenderSummary | null => {
  if (!fromMessages && !fromSqlite) {
    return null;
  }
  if (!fromMessages) {
    return fromSqlite;
  }
  if (!fromSqlite) {
    return fromMessages;
  }
  const connectedAtUnixMs = fromMessages.connectedAtUnixMs ?? fromSqlite.connectedAtUnixMs;
  const endedAtUnixMs = (() => {
    const messageEnded = fromMessages.endedAtUnixMs;
    const sqliteEnded = fromSqlite.endedAtUnixMs;
    // Prefer the earlier terminal stamp so a corrupt "app open" sqlite end cannot win.
    if (messageEnded != null && sqliteEnded != null) {
      return Math.min(messageEnded, sqliteEnded);
    }
    return sqliteEnded ?? messageEnded;
  })();
  // Sqlite may only flip to completed when the DM timeline has no terminal end yet.
  const endedNormally = fromMessages.endedNormally
    || (
      fromMessages.endedAtUnixMs == null
      && fromSqlite.endedNormally
      && fromSqlite.connectedAtUnixMs !== null
    );
  const durationSeconds = (() => {
    if (connectedAtUnixMs != null && endedAtUnixMs != null
      && (endedNormally || fromMessages.durationSeconds != null || fromSqlite.durationSeconds != null)) {
      return Math.max(0, Math.floor((endedAtUnixMs - connectedAtUnixMs) / 1000));
    }
    if (fromMessages.durationSeconds != null) {
      return fromMessages.durationSeconds;
    }
    return fromSqlite.connectedAtUnixMs !== null ? fromSqlite.durationSeconds : null;
  })();

  return {
    roomId: fromMessages.roomId,
    invitedAtUnixMs: fromMessages.invitedAtUnixMs ?? fromSqlite.invitedAtUnixMs,
    expiresAtUnixMs: fromMessages.expiresAtUnixMs ?? fromSqlite.expiresAtUnixMs,
    connectedAtUnixMs,
    endedAtUnixMs,
    // Do not let a non-answered sqlite "ended" flip the card to CALL COMPLETED.
    endedNormally,
    durationSeconds,
  };
};

export const loadNativeCallRecordSummaryIndex = async (
  profileId: string,
): Promise<ReadonlyMap<string, VoiceCallRoomRenderSummary>> => {
  const records = await loadSqliteCallRecords(profileId);
  const index = new Map<string, VoiceCallRoomRenderSummary>();
  records.forEach((record) => {
    index.set(record.call_id, mapCallRecordToVoiceCallRoomSummary(record));
  });
  return index;
};
