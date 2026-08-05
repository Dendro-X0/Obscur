/**
 * v2 slim — sole native DM write port (engine_invoke + fail-loud diagnostics).
 * @see specs/backend/engine-invoke-boundary-subtract-design-2026-07.md
 * @see docs/program/obscur-v2-slim-kernel-manifest.md
 */
import { isTauri } from "@dweb/db";
import type { ConversationRecord, MessageRecord } from "@dweb/db";
import { fetchDmThreadRows } from "@obscur/dm-engine";
import { createTauriEngineHost } from "@obscur/engine-host/tauri";
import type { HostEnginePort } from "@obscur/engine-contracts";
import { DM_ENGINE_METHODS } from "@obscur/engine-contracts";
import { logAppEvent } from "@/app/shared/log-app-event";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { isDmKernelAuthority } from "./dm-kernel-policy";
import {
  DM_KERNEL_WRITE_PROBE_CONVERSATION_ID,
  DM_KERNEL_WRITE_PROBE_PLAINTEXT,
} from "./dm-kernel-dev-lab-sidebar-policy";

export type DmKernelWriteResult = Readonly<{
  ok: boolean;
  reason: string;
  errorMessage: string | null;
}>;

let dmKernelWriteEngineHost: HostEnginePort | null = null;

const getDmKernelWriteEngineHost = (): HostEnginePort => {
  dmKernelWriteEngineHost ??= createTauriEngineHost();
  return dmKernelWriteEngineHost;
};

/** Test seam — reset cached host between vitest cases. */
export const dmKernelWritePortInternals = {
  resetEngineHostForTests: (): void => {
    dmKernelWriteEngineHost = null;
  },
  setEngineHostForTests: (host: HostEnginePort | null): void => {
    dmKernelWriteEngineHost = host;
  },
};

const logWriteFailure = (
  action: string,
  context: Record<string, unknown>,
  error: unknown,
): DmKernelWriteResult => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  logAppEvent({
    name: "dm_kernel.sqlite_write_failed",
    level: "error",
    scope: { feature: "messaging", action },
    context: {
      ...context,
      errorMessage: errorMessage.slice(0, 240),
    },
  });
  return { ok: false, reason: "invoke_failed", errorMessage };
};

export const isDmKernelWriteOwner = (): boolean => isDmKernelAuthority() && isTauri();

/**
 * Sole Tauri insert for DM message rows (bus flush + kernel probe).
 * Routes through engine_invoke `dm.insertMessage` — not bare `db_insert_message`.
 */
export const writeDmKernelMessage = async (record: MessageRecord): Promise<DmKernelWriteResult> => {
  if (!isTauri()) {
    return { ok: false, reason: "not_tauri", errorMessage: null };
  }
  try {
    const result = await getDmKernelWriteEngineHost().invoke({
      engine: "dm",
      method: DM_ENGINE_METHODS.insertMessage,
      scope: { profileId: record.profile_id },
      payload: record,
    });
    if (!result.ok) {
      return logWriteFailure("write_dm_kernel_message", {
        profileId: record.profile_id,
        conversationIdHint: record.conversation_id.slice(0, 24),
        eventIdHint: record.event_id.slice(0, 16),
        errorCode: result.errorCode ?? null,
      }, new Error(result.errorMessage ?? result.errorCode ?? "insertMessage failed"));
    }
    return { ok: true, reason: "insert_ok", errorMessage: null };
  } catch (error) {
    return logWriteFailure("write_dm_kernel_message", {
      profileId: record.profile_id,
      conversationIdHint: record.conversation_id.slice(0, 24),
      eventIdHint: record.event_id.slice(0, 16),
    }, error);
  }
};

/** Sole Tauri upsert for DM conversation sidebar rows after a message write. */
export const writeDmKernelConversation = async (
  record: ConversationRecord,
): Promise<DmKernelWriteResult> => {
  if (!isTauri()) {
    return { ok: false, reason: "not_tauri", errorMessage: null };
  }
  try {
    const result = await getDmKernelWriteEngineHost().invoke({
      engine: "dm",
      method: DM_ENGINE_METHODS.upsertConversation,
      scope: { profileId: record.profile_id },
      payload: record,
    });
    if (!result.ok) {
      return logWriteFailure("write_dm_kernel_conversation", {
        profileId: record.profile_id,
        conversationIdHint: record.id.slice(0, 24),
        errorCode: result.errorCode ?? null,
      }, new Error(result.errorMessage ?? result.errorCode ?? "upsertConversation failed"));
    }
    return { ok: true, reason: "upsert_ok", errorMessage: null };
  } catch (error) {
    return logWriteFailure("write_dm_kernel_conversation", {
      profileId: record.profile_id,
      conversationIdHint: record.id.slice(0, 24),
    }, error);
  }
};

const PROBE_CONVERSATION_ID = DM_KERNEL_WRITE_PROBE_CONVERSATION_ID;

/** CDP / Dev Lab gate — roundtrip insert + read before DM scenarios. */
export const probeDmKernelWrite = async (): Promise<DmKernelWriteResult> => {
  if (!isDmKernelWriteOwner()) {
    return { ok: false, reason: "not_dm_kernel_write_owner", errorMessage: null };
  }

  const profileId = getResolvedProfileId()?.trim();
  if (!profileId) {
    return { ok: false, reason: "no_profile_id", errorMessage: null };
  }

  const probeEventId = `dm-kernel-probe-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  const receivedAt = Date.now();
  const record: MessageRecord = {
    event_id: probeEventId,
    profile_id: profileId,
    conversation_id: PROBE_CONVERSATION_ID,
    sender_pubkey: "0000000000000000000000000000000000000000000000000000000000000001",
    recipient_pubkey: "0000000000000000000000000000000000000000000000000000000000000002",
    plaintext: DM_KERNEL_WRITE_PROBE_PLAINTEXT,
    kind: 4,
    created_at: Math.floor(receivedAt / 1000),
    received_at: receivedAt,
    is_outgoing: false,
    reply_to_event_id: null,
    has_attachment: false,
  };

  const insert = await writeDmKernelMessage(record);
  if (!insert.ok) {
    logAppEvent({
      name: "dm_kernel.write_probe",
      level: "error",
      scope: { feature: "messaging", action: "dm_kernel_write_probe" },
      context: { profileId, reason: insert.reason, errorMessage: insert.errorMessage },
    });
    return insert;
  }

  try {
    const rows = await fetchDmThreadRows({
      host: getDmKernelWriteEngineHost(),
      profileId,
      payload: { conversationId: PROBE_CONVERSATION_ID, limit: 5 },
    });
    const roundtripOk = rows.some((row) => row.event_id === probeEventId);
    const result: DmKernelWriteResult = {
      ok: roundtripOk,
      reason: roundtripOk ? "roundtrip_ok" : "read_miss_after_insert",
      errorMessage: null,
    };
    logAppEvent({
      name: "dm_kernel.write_probe",
      level: roundtripOk ? "info" : "error",
      scope: { feature: "messaging", action: "dm_kernel_write_probe" },
      context: { profileId, reason: result.reason },
    });
    return result;
  } catch (error) {
    return logWriteFailure("dm_kernel_write_probe_read", { profileId }, error);
  }
};
