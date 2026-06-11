// @ts-nocheck
/**
 * @deprecated Native DM must use `features/dm-kernel/`. Web legacy only.
 * @see docs/program/obscur-v2-slim-kernel-manifest.md
 *
 * R1 subtraction — native DM thread hydrate (SQLite-only).
 *
 * Replaces `runDmConversationHydrateReadModelPipeline` + `assembleDmHydrateThreadReadModel`
 * on desktop. No projection authority, chat-state fallback, gap-fill, or multi-pass deep scan.
 * Progressive depth is owned by explicit user scroll + `loadEarlierMessages`.
 */

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { logAppEvent } from "@/app/shared/log-app-event";
import { toConversationIdDiagnosticLabel } from "@dweb/client-gateway/messaging-diagnostics";
import type { Message } from "../types";
import {
  filterMessagesBySuppressedIds,
  mergeHydratedBaseWithLiveOverlayMessages,
} from "./thread-message-list-utils";
import { isDisplayableDmConversationMessage } from "./dm-conversation-displayable-message";
import { mapIndexedConversationRowsForDisplayableScan } from "./dm-conversation-hydrate-indexed-map-rows";
import { loadConversationWindowAcrossAliases } from "./dm-conversation-hydrate-indexed-scan";
import type {
  AssembleDmHydrateThreadReadModelResult,
  RunDmConversationHydrateReadModelPipelineParams,
} from "./thread-history/port";
import { normalizeDmConversationMessageRow } from "./dm-conversation-normalize-message";
import { messagingClientOperations } from "./messaging-client-operations";
import { prepareDmThreadSuppressionIds } from "./dm-thread-suppression-prepare";

const NATIVE_DM_SQLITE_AUTHORITY = "native_sqlite_only" as const;

export const runNativeDmThreadHydrateReadModel = async (
  params: RunDmConversationHydrateReadModelPipelineParams,
): Promise<AssembleDmHydrateThreadReadModelResult> => {
  const {
    conversationId: cid,
    conversationIds,
    profileIdForTombstones,
    messageDeleteTombstones,
    persistedDeletedIds,
    publicKeyHex,
    normalizedPublicKeyHex,
    localMessageRetentionDays,
    numeric,
    liveMessages,
    expandedHistory,
  } = params;

  const preparedSuppressionIds = await prepareDmThreadSuppressionIds({
    profileId: profileIdForTombstones,
    accountPublicKeyHex: normalizedPublicKeyHex,
    projection: params.accountProjection,
    messageDeleteTombstones,
    seedIds: persistedDeletedIds,
  });
  persistedDeletedIds.clear();
  preparedSuppressionIds.forEach((id) => persistedDeletedIds.add(id));

  const mapRowsToDisplayableMessages = (rows: ReadonlyArray<unknown>): ReadonlyArray<Message> => (
    mapIndexedConversationRowsForDisplayableScan({
      pipeline: "native_sqlite_hydrate",
      rows,
      normalizeRow: (row: unknown) => normalizeDmConversationMessageRow(row, {
        conversationId: typeof (row as { conversationId?: string })?.conversationId === "string"
          ? (row as { conversationId: string }).conversationId
          : cid,
        myPublicKeyHex: publicKeyHex,
      }),
      persistentSuppressedMessageIds: persistedDeletedIds,
      isDisplayable: isDisplayableDmConversationMessage,
      localMessageRetentionDays,
    })
  );

  const latestWindow = await loadConversationWindowAcrossAliases({
    conversationIds,
    limit: numeric.initialBatchSize,
    accountPublicKeyHex: normalizedPublicKeyHex,
  });
  const mappedMessages = mapRowsToDisplayableMessages(latestWindow.rows);
  const shouldCap = !expandedHistory && mappedMessages.length > numeric.liveWindowSoftLimit;
  let finalMessages: ReadonlyArray<Message> = shouldCap
    ? mappedMessages.slice(-numeric.liveWindowSoftLimit)
    : mappedMessages;

  if (liveMessages.length > 0) {
    const allowedConversationIds = new Set(
      conversationIds.map((id) => id.trim()).filter((id) => id.length > 0),
    );
    const mergedBase = mergeHydratedBaseWithLiveOverlayMessages(
      finalMessages,
      liveMessages,
      allowedConversationIds,
    );
    const merged = filterMessagesBySuppressedIds(
      mergedBase.filter(isDisplayableDmConversationMessage),
      persistedDeletedIds,
    ).sort((left, right) => left.timestamp.getTime() - right.timestamp.getTime());
    const shouldCapMerged = !expandedHistory && merged.length > numeric.liveWindowSoftLimit;
    finalMessages = shouldCapMerged ? merged.slice(-numeric.liveWindowSoftLimit) : merged;
  }

  const profileId = getResolvedProfileId() || "";
  const visibilityFiltered = profileId
    ? messagingClientOperations.filterVisibleDmMessages(finalMessages, profileId)
    : finalMessages;

  const authorityDiagnosticKey = [
    NATIVE_DM_SQLITE_AUTHORITY,
    cid,
    profileIdForTombstones ?? "",
    visibilityFiltered.length,
    latestWindow.hasEarlier ? "earlier" : "latest",
  ].join("::");

  logAppEvent({
    name: "messaging.native_dm_sqlite_hydrate",
    level: "info",
    scope: { feature: "messaging", action: "native_dm_sqlite_hydrate" },
    context: {
      conversationIdHint: toConversationIdDiagnosticLabel(cid),
      sqliteRowCount: latestWindow.rows.length,
      displayableCount: visibilityFiltered.length,
      hasEarlier: latestWindow.hasEarlier,
      expandedHistory,
      capped: shouldCap,
    },
  });

  const mappedDirectionCounts = countDirections(visibilityFiltered, normalizedPublicKeyHex);

  return {
    finalMessages: visibilityFiltered,
    authorityDecision: {
      authority: "indexed",
      reason: "native_sqlite_only",
    },
    hasEarlier: latestWindow.hasEarlier && visibilityFiltered.length > 0,
    projectionFallbackHydration: false,
    authorityDiagnosticKey,
    authorityLogContext: {
      conversationIdHint: toConversationIdDiagnosticLabel(cid),
      selectedAuthority: NATIVE_DM_SQLITE_AUTHORITY,
      selectedAuthorityReason: "native_sqlite_only",
      indexedMessageCount: visibilityFiltered.length,
      indexedOutgoingCount: mappedDirectionCounts.outgoing,
      indexedIncomingCount: mappedDirectionCounts.incoming,
    },
    hydrationDiagnosticsLogContext: null,
    hydrated: visibilityFiltered,
    mappedDirectionCounts,
  };
};

const countDirections = (
  messages: ReadonlyArray<Message>,
  myPublicKeyHex: PublicKeyHex | null,
): Readonly<{ outgoing: number; incoming: number }> => {
  let outgoing = 0;
  let incoming = 0;
  messages.forEach((message) => {
    if (message.isOutgoing === true) {
      outgoing += 1;
    } else {
      incoming += 1;
    }
  });
  void myPublicKeyHex;
  return { outgoing, incoming };
};
