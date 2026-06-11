import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { dbGetMessages, isTauri } from "@dweb/db";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { logAppEvent } from "@/app/shared/log-app-event";
import { toConversationIdDiagnosticLabel } from "@dweb/client-gateway/messaging-diagnostics";
import { maybeScheduleNativeDmRelayBackfillRepair } from "./native-dm-sqlite-repair";
import type { Message } from "../types";
import { isNativeDmSqliteReadOwner } from "./native-dm-read-policy";
import { evaluateDirectionCoverage } from "./dm-thread-read-model";
import { toDmConversationId } from "../utils/dm-conversation-id";

export type NativeDmSqliteDirectionCounts = Readonly<{
  outgoing: number;
  incoming: number;
  total: number;
}>;

export const countNativeDmSqliteDirections = async (params: Readonly<{
  conversationId: string;
  myPublicKeyHex: PublicKeyHex;
  profileId?: string;
  limit?: number;
}>): Promise<NativeDmSqliteDirectionCounts | null> => {
  if (!isTauri() || !isNativeDmSqliteReadOwner()) {
    return null;
  }
  const profileId = params.profileId?.trim() || getResolvedProfileId().trim();
  if (!profileId) {
    return null;
  }
  const limit = params.limit ?? 500;
  try {
    const rows = await dbGetMessages(profileId, params.conversationId, limit);
    let outgoing = 0;
    let incoming = 0;
    const account = params.myPublicKeyHex.trim().toLowerCase();
    rows.forEach((row) => {
      if (row.is_outgoing) {
        outgoing += 1;
        return;
      }
      const sender = row.sender_pubkey.trim().toLowerCase();
      const recipient = row.recipient_pubkey.trim().toLowerCase();
      if (sender === account) {
        outgoing += 1;
      } else if (recipient === account) {
        incoming += 1;
      } else {
        incoming += 1;
      }
    });
    return { outgoing, incoming, total: rows.length };
  } catch {
    return null;
  }
};

export type NativeDmSqliteHydrateIntegrityResult = Readonly<{
  violation: boolean;
  reason: "none" | "hydrate_one_sided" | "sqlite_ui_mismatch" | "sqlite_read_failed";
  hydrated: NativeDmSqliteDirectionCounts;
  sqlite: NativeDmSqliteDirectionCounts | null;
}>;

export const evaluateNativeDmSqliteHydrateIntegrity = async (params: Readonly<{
  conversationId: string;
  myPublicKeyHex: PublicKeyHex | null;
  hydratedMessages: ReadonlyArray<Message>;
  profileId?: string;
}>): Promise<NativeDmSqliteHydrateIntegrityResult | null> => {
  if (!isNativeDmSqliteReadOwner() || !params.myPublicKeyHex || params.hydratedMessages.length === 0) {
    return null;
  }
  const hydratedCoverage = evaluateDirectionCoverage(params.hydratedMessages, params.myPublicKeyHex);
  const hydrated: NativeDmSqliteDirectionCounts = {
    outgoing: hydratedCoverage.outgoing,
    incoming: hydratedCoverage.incoming,
    total: params.hydratedMessages.length,
  };
  const sqlite = await countNativeDmSqliteDirections({
    conversationId: params.conversationId,
    myPublicKeyHex: params.myPublicKeyHex,
    profileId: params.profileId,
  });
  if (!sqlite) {
    return {
      violation: true,
      reason: "sqlite_read_failed",
      hydrated,
      sqlite: null,
    };
  }
  if (hydratedCoverage.isPartial) {
    return {
      violation: true,
      reason: "hydrate_one_sided",
      hydrated,
      sqlite,
    };
  }
  const sqlitePartial = sqlite.total > 0 && (
    (sqlite.outgoing > 0 && sqlite.incoming === 0)
    || (sqlite.incoming > 0 && sqlite.outgoing === 0)
  );
  const uiComplete = !hydratedCoverage.isPartial;
  if (sqlitePartial && uiComplete) {
    return {
      violation: true,
      reason: "sqlite_ui_mismatch",
      hydrated,
      sqlite,
    };
  }
  return {
    violation: false,
    reason: "none",
    hydrated,
    sqlite,
  };
};

export const logNativeDmSqliteHydrateIntegrity = async (params: Readonly<{
  conversationId: string;
  myPublicKeyHex: PublicKeyHex | null;
  hydratedMessages: ReadonlyArray<Message>;
  profileId?: string;
  trigger: string;
}>): Promise<void> => {
  const result = await evaluateNativeDmSqliteHydrateIntegrity({
    conversationId: params.conversationId,
    myPublicKeyHex: params.myPublicKeyHex,
    hydratedMessages: params.hydratedMessages,
    profileId: params.profileId,
  });
  if (!result?.violation) {
    return;
  }
  logAppEvent({
    name: "messaging.native_dm_sqlite_integrity_violation",
    level: "error",
    scope: { feature: "messaging", action: "native_dm_sqlite_integrity" },
    context: {
      trigger: params.trigger,
      reason: result.reason,
      conversationIdHint: toConversationIdDiagnosticLabel(params.conversationId),
      hydratedOutgoing: result.hydrated.outgoing,
      hydratedIncoming: result.hydrated.incoming,
      hydratedTotal: result.hydrated.total,
      sqliteOutgoing: result.sqlite?.outgoing ?? null,
      sqliteIncoming: result.sqlite?.incoming ?? null,
      sqliteTotal: result.sqlite?.total ?? null,
    },
  });
  const profileId = params.profileId?.trim() || getResolvedProfileId().trim();
  if (
    profileId
    && result.reason !== "sqlite_read_failed"
    && (
      result.reason === "hydrate_one_sided"
      || (result.sqlite && (
        (result.sqlite.outgoing > 0 && result.sqlite.incoming === 0)
        || (result.sqlite.incoming > 0 && result.sqlite.outgoing === 0)
      ))
    )
  ) {
    maybeScheduleNativeDmRelayBackfillRepair({
      profileId,
      reason: result.reason,
      conversationId: params.conversationId,
      trigger: params.trigger,
    });
  }
};

export const loadNativeDmSqlitePeerThreadSnapshots = async (params: Readonly<{
  peerPublicKeyHex: string;
  myPublicKeyHex: PublicKeyHex;
  profileId?: string;
  limit?: number;
}>): Promise<ReadonlyArray<Readonly<{
  id: string;
  content: string;
  isOutgoing: boolean;
  status: string;
}>>> => {
  const conversationId = toDmConversationId({
    myPublicKeyHex: params.myPublicKeyHex,
    peerPublicKeyHex: params.peerPublicKeyHex,
  });
  if (!conversationId) {
    return [];
  }
  const profileId = params.profileId?.trim() || getResolvedProfileId().trim();
  if (!profileId) {
    return [];
  }
  const rows = await dbGetMessages(profileId, conversationId, params.limit ?? 200);
  const account = params.myPublicKeyHex.trim().toLowerCase();
  return rows.map((row) => ({
    id: row.event_id,
    content: row.plaintext,
    isOutgoing: row.is_outgoing || row.sender_pubkey.trim().toLowerCase() === account,
    status: "delivered",
  }));
};
