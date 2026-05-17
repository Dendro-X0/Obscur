/**
 * Delete-for-everyone — **local destructive** cleanup (canonical DM shell owner: `localDmVisibility`).
 *
 * Network publish/ingest proves intent; this module **physically** removes persisted rows and
 * redacts projection timeline entries so hydrate/restore cannot resurrect deleted messages.
 *
 * Intentionally delegates to the same implementation as delete-for-me (`executeDeleteForMe`):
 * one purge pipeline for all irreversible local deletes (no parallel legacy stores).
 */

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { messagingClientOperations } from "./messaging-client-operations";
import { emitAccountSyncMutation } from "@/app/shared/account-sync-mutation-signal";
import { logAppEvent } from "@/app/shared/log-app-event";

export type DestructiveDmDeleteForEveryoneLocalParams = Readonly<{
  conversationId: string;
  messageIdentityIds: ReadonlyArray<string>;
  accountPublicKeyHex: PublicKeyHex;
  profileId: string;
  observedAtUnixMs?: number;
  /** Receiver ingest: avoid projection replay storms (default true for sender purge). */
  replayProjection?: boolean;
  /** Receiver ingest: durable stores only; event-log reconcile runs later via backup. */
  skipEventLogReconcile?: boolean;
  prioritizeUiResponse?: boolean;
  redactTimelineEvents?: boolean;
}>;

/**
 * Irreversible local destruction after delete-for-everyone is confirmed (sender after relay OK,
 * or receiver after validated remote delete command). Wipes IndexedDB/SQLite message rows,
 * tombstone ports, chat-state aliases, and redacts DM projection events.
 */
export async function applyDestructiveDmDeleteForEveryoneLocal(
  params: DestructiveDmDeleteForEveryoneLocalParams,
): Promise<ReadonlyArray<string>> {
  const profileId = params.profileId.trim();
  if (!profileId) {
    return [];
  }
  const ids = await messagingClientOperations.deleteDmForMe({
    conversationId: params.conversationId,
    messageIdentityIds: params.messageIdentityIds,
    accountPublicKeyHex: params.accountPublicKeyHex,
    profileId,
    observedAtUnixMs: params.observedAtUnixMs ?? Date.now(),
    replayProjection: params.replayProjection,
    skipEventLogReconcile: params.skipEventLogReconcile,
    prioritizeUiResponse: params.prioritizeUiResponse,
    redactTimelineEvents: params.redactTimelineEvents ?? true,
  });

  // Tombstones only — do not emit dm_history_changed here; account-sync treats that
  // as a signal to pull relay backup and can resurrect messages recall just removed.
  emitAccountSyncMutation("message_delete_tombstones_changed", { profileId });

  logAppEvent({
    name: "messaging.delete_for_everyone_local_destruction_applied",
    level: "info",
    scope: { feature: "messaging", action: "delete_for_everyone" },
    context: {
      conversationIdHint: params.conversationId.slice(0, 32),
      deleteTargetCount: ids.length,
    },
  });

  return ids;
}
