import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { dbGetConversations, isTauri } from "@dweb/db";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { logAppEvent } from "@/app/shared/log-app-event";
import { toConversationIdDiagnosticLabel } from "@dweb/client-gateway/messaging-diagnostics";
import { isNativeDmSqliteReadOwner } from "./native-dm-read-policy";
import {
  countNativeDmSqliteDirections,
  type NativeDmSqliteDirectionCounts,
} from "./native-dm-sqlite-integrity";

export const NATIVE_DM_SQLITE_RELAY_BACKFILL_REPAIR_EVENT = "obscur:native-dm-sqlite-relay-backfill-repair";

export const NATIVE_DM_REPAIR_COOLDOWN_MS = 60_000;

export type NativeDmOneSidedConversation = Readonly<{
  conversationId: string;
  peerPublicKeyHex: string;
  outgoing: number;
  incoming: number;
  total: number;
  missingDirection: "incoming" | "outgoing";
}>;

export type NativeDmSqliteRelayBackfillRepairDetail = Readonly<{
  profileId: string;
  reason: string;
  conversationIds: ReadonlyArray<string>;
  sinceUnixMs: number;
  trigger: string;
}>;

export type NativeDmSqliteRepairScanReport = Readonly<{
  profileId: string;
  scannedConversationCount: number;
  oneSidedConversations: ReadonlyArray<NativeDmOneSidedConversation>;
  repairRequested: boolean;
}>;

const repairCooldownByProfileId = new Map<string, number>();

export type NativeDmPeerMessageDirections = Readonly<{
  outgoing: number;
  incoming: number;
  total: number;
  isBidirectional: boolean;
  isOneSided: boolean;
}>;

export const summarizeNativeDmPeerMessageDirections = (
  messages: ReadonlyArray<{ isOutgoing: boolean }>,
): NativeDmPeerMessageDirections => {
  let outgoing = 0;
  let incoming = 0;
  for (const message of messages) {
    if (message.isOutgoing) {
      outgoing += 1;
    } else {
      incoming += 1;
    }
  }
  const total = messages.length;
  const counts: NativeDmSqliteDirectionCounts = { outgoing, incoming, total };
  return {
    outgoing,
    incoming,
    total,
    isBidirectional: total > 0 && outgoing > 0 && incoming > 0,
    isOneSided: isOneSidedNativeDmSqliteDirections(counts),
  };
};

export const isOneSidedNativeDmSqliteDirections = (
  counts: NativeDmSqliteDirectionCounts,
): boolean => (
  counts.total > 0
  && (
    (counts.outgoing > 0 && counts.incoming === 0)
    || (counts.incoming > 0 && counts.outgoing === 0)
  )
);

export const toOneSidedConversation = (params: Readonly<{
  conversationId: string;
  peerPublicKeyHex: string;
  counts: NativeDmSqliteDirectionCounts;
}>): NativeDmOneSidedConversation | null => {
  if (!isOneSidedNativeDmSqliteDirections(params.counts)) {
    return null;
  }
  return {
    conversationId: params.conversationId,
    peerPublicKeyHex: params.peerPublicKeyHex,
    outgoing: params.counts.outgoing,
    incoming: params.counts.incoming,
    total: params.counts.total,
    missingDirection: params.counts.outgoing > 0 ? "incoming" : "outgoing",
  };
};

export const canScheduleNativeDmRelayBackfillRepair = (
  profileId: string,
  nowMs: number = Date.now(),
): boolean => {
  const last = repairCooldownByProfileId.get(profileId.trim()) ?? 0;
  return nowMs - last >= NATIVE_DM_REPAIR_COOLDOWN_MS;
};

export const markNativeDmRelayBackfillRepairScheduled = (
  profileId: string,
  nowMs: number = Date.now(),
): void => {
  repairCooldownByProfileId.set(profileId.trim(), nowMs);
};

export const resetNativeDmRelayBackfillRepairCooldownForTests = (): void => {
  repairCooldownByProfileId.clear();
};

export const scanNativeDmOneSidedConversations = async (params: Readonly<{
  profileId: string;
  myPublicKeyHex: PublicKeyHex;
  perConversationLimit?: number;
}>): Promise<ReadonlyArray<NativeDmOneSidedConversation>> => {
  if (!isTauri() || !isNativeDmSqliteReadOwner()) {
    return [];
  }
  const profileId = params.profileId.trim();
  if (!profileId) {
    return [];
  }
  const conversations = await dbGetConversations(profileId);
  const oneSided: NativeDmOneSidedConversation[] = [];
  for (const conversation of conversations) {
    const conversationId = conversation.id?.trim();
    const peerPublicKeyHex = conversation.peer_pubkey?.trim();
    if (!conversationId || !peerPublicKeyHex) {
      continue;
    }
    const counts = await countNativeDmSqliteDirections({
      conversationId,
      myPublicKeyHex: params.myPublicKeyHex,
      profileId,
      limit: params.perConversationLimit,
    });
    if (!counts) {
      continue;
    }
    const entry = toOneSidedConversation({
      conversationId,
      peerPublicKeyHex,
      counts,
    });
    if (entry) {
      oneSided.push(entry);
    }
  }
  return oneSided;
};

export const requestNativeDmRelayBackfillRepair = (params: Readonly<{
  profileId: string;
  reason: string;
  conversationIds: ReadonlyArray<string>;
  trigger: string;
  sinceUnixMs?: number;
  skipCooldown?: boolean;
}>): boolean => {
  const profileId = params.profileId.trim();
  if (!profileId || typeof window === "undefined") {
    return false;
  }
  if (!params.skipCooldown && !canScheduleNativeDmRelayBackfillRepair(profileId)) {
    logAppEvent({
      name: "messaging.native_dm_sqlite_repair_skipped_cooldown",
      level: "warn",
      scope: { feature: "messaging", action: "native_dm_sqlite_repair" },
      context: {
        profileId,
        reason: params.reason,
        trigger: params.trigger,
        conversationCount: params.conversationIds.length,
      },
    });
    return false;
  }
  markNativeDmRelayBackfillRepairScheduled(profileId);
  const detail: NativeDmSqliteRelayBackfillRepairDetail = {
    profileId,
    reason: params.reason,
    conversationIds: params.conversationIds,
    sinceUnixMs: params.sinceUnixMs ?? 0,
    trigger: params.trigger,
  };
  window.dispatchEvent(new CustomEvent(NATIVE_DM_SQLITE_RELAY_BACKFILL_REPAIR_EVENT, { detail }));
  logAppEvent({
    name: "messaging.native_dm_sqlite_repair_relay_backfill_requested",
    level: "warn",
    scope: { feature: "messaging", action: "native_dm_sqlite_repair" },
    context: {
      profileId,
      reason: params.reason,
      trigger: params.trigger,
      sinceUnixMs: detail.sinceUnixMs,
      conversationCount: params.conversationIds.length,
      conversationIdHints: params.conversationIds
        .slice(0, 5)
        .map((id) => toConversationIdDiagnosticLabel(id))
        .join(","),
    },
  });
  return true;
};

export const maybeScheduleNativeDmRelayBackfillRepair = (params: Readonly<{
  profileId: string;
  reason: string;
  conversationId: string;
  trigger: string;
}>): boolean => (
  requestNativeDmRelayBackfillRepair({
    profileId: params.profileId,
    reason: params.reason,
    conversationIds: [params.conversationId],
    trigger: params.trigger,
    sinceUnixMs: 0,
  })
);

export const runNativeDmSqliteProfileRepairScan = async (params: Readonly<{
  profileId?: string;
  myPublicKeyHex: PublicKeyHex;
  trigger: string;
  requestBackfill?: boolean;
}>): Promise<NativeDmSqliteRepairScanReport> => {
  const profileId = params.profileId?.trim() || getResolvedProfileId().trim();
  if (!profileId) {
    return {
      profileId: "",
      scannedConversationCount: 0,
      oneSidedConversations: [],
      repairRequested: false,
    };
  }
  const conversations = await dbGetConversations(profileId).catch(() => []);
  const oneSidedConversations = await scanNativeDmOneSidedConversations({
    profileId,
    myPublicKeyHex: params.myPublicKeyHex,
  });
  const requestBackfill = params.requestBackfill !== false;
  const repairRequested = requestBackfill && oneSidedConversations.length > 0
    ? requestNativeDmRelayBackfillRepair({
      profileId,
      reason: "profile_one_sided_scan",
      conversationIds: oneSidedConversations.map((entry) => entry.conversationId),
      trigger: params.trigger,
      sinceUnixMs: 0,
    })
    : false;
  if (oneSidedConversations.length > 0) {
    logAppEvent({
      name: "messaging.native_dm_sqlite_repair_scan_complete",
      level: repairRequested ? "warn" : "info",
      scope: { feature: "messaging", action: "native_dm_sqlite_repair" },
      context: {
        profileId,
        trigger: params.trigger,
        scannedConversationCount: conversations.length,
        oneSidedConversationCount: oneSidedConversations.length,
        repairRequested,
      },
    });
  }
  return {
    profileId,
    scannedConversationCount: conversations.length,
    oneSidedConversations,
    repairRequested,
  };
};

export const subscribeNativeDmRelayBackfillRepair = (
  listener: (detail: NativeDmSqliteRelayBackfillRepairDetail) => void,
): (() => void) => {
  if (typeof window === "undefined") {
    return (): void => undefined;
  }
  const handler = (event: Event): void => {
    const detail = (event as CustomEvent<NativeDmSqliteRelayBackfillRepairDetail>).detail;
    if (!detail?.profileId) {
      return;
    }
    listener(detail);
  };
  window.addEventListener(NATIVE_DM_SQLITE_RELAY_BACKFILL_REPAIR_EVENT, handler);
  return (): void => {
    window.removeEventListener(NATIVE_DM_SQLITE_RELAY_BACKFILL_REPAIR_EVENT, handler);
  };
};
