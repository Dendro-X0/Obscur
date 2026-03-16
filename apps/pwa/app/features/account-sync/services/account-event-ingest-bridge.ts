"use client";

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { AccountEvent } from "../account-event-contracts";
import { getActiveProfileIdSafe } from "@/app/features/profiles/services/profile-scope";
import { logAppEvent } from "@/app/shared/log-app-event";
import { accountProjectionRuntime } from "./account-projection-runtime";

type ContactEventType =
  | "CONTACT_REQUEST_RECEIVED"
  | "CONTACT_REQUEST_SENT"
  | "CONTACT_ACCEPTED"
  | "CONTACT_DECLINED"
  | "CONTACT_CANCELED"
  | "CONTACT_REMOVED";

const resolveSuffix = (
  preferred?: string,
  fallback?: string,
): string => {
  if (preferred && preferred.trim().length > 0) {
    return preferred;
  }
  if (fallback && fallback.trim().length > 0) {
    return fallback;
  }
  return `${Date.now()}`;
};

let unsupportedRuntimeLogged = false;

const appendEventsSafely = async (params: Readonly<{
  profileId?: string;
  accountPublicKeyHex: PublicKeyHex;
  events: ReadonlyArray<AccountEvent>;
  operation: string;
}>): Promise<void> => {
  if (params.events.length === 0) {
    return;
  }
  if (typeof indexedDB === "undefined" || typeof IDBKeyRange === "undefined") {
    if (!unsupportedRuntimeLogged) {
      unsupportedRuntimeLogged = true;
      logAppEvent({
        name: "account_projection.append_events_unavailable",
        level: "warn",
        scope: { feature: "account_sync", action: "projection_ingest" },
        context: {
          operation: params.operation,
          reason: "indexeddb_unavailable",
        },
      });
    }
    return;
  }
  const profileId = params.profileId ?? getActiveProfileIdSafe();
  try {
    await accountProjectionRuntime.appendCanonicalEvents({
      profileId,
      accountPublicKeyHex: params.accountPublicKeyHex,
      events: params.events,
    });
  } catch (error) {
    logAppEvent({
      name: "account_projection.append_events_failed",
      level: "warn",
      scope: { feature: "account_sync", action: "projection_ingest" },
      context: {
        operation: params.operation,
        profileId,
        accountPublicKeyHex: params.accountPublicKeyHex.slice(0, 16),
        eventCount: params.events.length,
        reason: error instanceof Error ? error.message : String(error),
      },
    });
  }
};

export const appendCanonicalContactEvent = async (params: Readonly<{
  profileId?: string;
  accountPublicKeyHex: PublicKeyHex;
  peerPublicKeyHex: PublicKeyHex;
  type: ContactEventType;
  direction: "incoming" | "outgoing" | "unknown";
  requestEventId?: string;
  idempotencySuffix?: string;
  source?: AccountEvent["source"];
}>): Promise<void> => {
  const event = accountProjectionRuntime.createContactEvent({
    type: params.type,
    profileId: params.profileId ?? getActiveProfileIdSafe(),
    accountPublicKeyHex: params.accountPublicKeyHex,
    peerPublicKeyHex: params.peerPublicKeyHex,
    direction: params.direction,
    requestEventId: params.requestEventId,
    idempotencySuffix: resolveSuffix(
      params.idempotencySuffix,
      params.requestEventId ?? params.peerPublicKeyHex,
    ),
    source: params.source,
  });
  await appendEventsSafely({
    profileId: params.profileId,
    accountPublicKeyHex: params.accountPublicKeyHex,
    events: [event],
    operation: params.type,
  });
};

export const appendCanonicalDmEvent = async (params: Readonly<{
  profileId?: string;
  accountPublicKeyHex: PublicKeyHex;
  peerPublicKeyHex: PublicKeyHex;
  type: "DM_RECEIVED" | "DM_SENT_CONFIRMED";
  conversationId: string;
  messageId: string;
  eventCreatedAtUnixSeconds: number;
  plaintextPreview: string;
  idempotencySuffix?: string;
  source?: AccountEvent["source"];
}>): Promise<void> => {
  const event = accountProjectionRuntime.createDmEvent({
    type: params.type,
    profileId: params.profileId ?? getActiveProfileIdSafe(),
    accountPublicKeyHex: params.accountPublicKeyHex,
    peerPublicKeyHex: params.peerPublicKeyHex,
    conversationId: params.conversationId,
    messageId: params.messageId,
    eventCreatedAtUnixSeconds: params.eventCreatedAtUnixSeconds,
    plaintextPreview: params.plaintextPreview,
    idempotencySuffix: resolveSuffix(params.idempotencySuffix, params.messageId),
    source: params.source,
  });
  await appendEventsSafely({
    profileId: params.profileId,
    accountPublicKeyHex: params.accountPublicKeyHex,
    events: [event],
    operation: params.type,
  });
};

export const appendCanonicalDecryptFailedEvent = async (params: Readonly<{
  profileId?: string;
  accountPublicKeyHex: PublicKeyHex;
  peerPublicKeyHex: PublicKeyHex;
  messageId: string;
  reason: string;
  idempotencySuffix?: string;
  source?: AccountEvent["source"];
}>): Promise<void> => {
  const event = accountProjectionRuntime.createDecryptFailedEvent({
    profileId: params.profileId ?? getActiveProfileIdSafe(),
    accountPublicKeyHex: params.accountPublicKeyHex,
    peerPublicKeyHex: params.peerPublicKeyHex,
    messageId: params.messageId,
    reason: params.reason,
    idempotencySuffix: resolveSuffix(params.idempotencySuffix, params.messageId),
    source: params.source,
  });
  await appendEventsSafely({
    profileId: params.profileId,
    accountPublicKeyHex: params.accountPublicKeyHex,
    events: [event],
    operation: "DM_DECRYPT_FAILED_QUARANTINED",
  });
};

export const appendCanonicalSyncCheckpointEvent = async (params: Readonly<{
  profileId?: string;
  accountPublicKeyHex: PublicKeyHex;
  timelineKey: string;
  lastProcessedAtUnixSeconds: number;
  idempotencySuffix?: string;
  source?: AccountEvent["source"];
}>): Promise<void> => {
  const event = accountProjectionRuntime.createSyncCheckpointEvent({
    profileId: params.profileId ?? getActiveProfileIdSafe(),
    accountPublicKeyHex: params.accountPublicKeyHex,
    timelineKey: params.timelineKey,
    lastProcessedAtUnixSeconds: params.lastProcessedAtUnixSeconds,
    idempotencySuffix: resolveSuffix(params.idempotencySuffix, `${params.timelineKey}:${params.lastProcessedAtUnixSeconds}`),
    source: params.source,
  });
  await appendEventsSafely({
    profileId: params.profileId,
    accountPublicKeyHex: params.accountPublicKeyHex,
    events: [event],
    operation: "SYNC_CHECKPOINT_ADVANCED",
  });
};
