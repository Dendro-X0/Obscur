/**
 * Hydration-time diagnostics when indexed rows look incoming-only but sibling conversation ids may hold outgoing under legacy id splits (R1).
 */

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { Message } from "../types";
import { logAppEvent } from "@/app/shared/log-app-event";
import { buildDmSiblingConversationIds } from "../utils/dm-conversation-sibling-ids";
import { loadConversationWindow } from "./dm-conversation-hydrate-indexed-scan";
import { toConversationIdDiagnosticLabel } from "@dweb/client-gateway/messaging-diagnostics";
import { getMessageDirectionCounts } from "./dm-conversation-hydrate-read-model";

export async function runDmHydrateSiblingIdSplitDiagnosticsIfNeeded(params: Readonly<{
  conversationId: string;
  normalizedPublicKeyHex: PublicKeyHex;
  mappedDirectionCounts: Readonly<{ incoming: number; outgoing: number }>;
  initialBatchSize: number;
  projectionReadAuthoritySnapshot: Readonly<{ reason: string; criticalDriftCount: number }>;
  normalizeIndexedRowToMessage: (entry: any, siblingConversationId: string) => Message;
}>): Promise<void> {
  const { mappedDirectionCounts } = params;
  if (mappedDirectionCounts.incoming <= 0 || mappedDirectionCounts.outgoing !== 0) {
    return;
  }

  const siblingConversationIds = buildDmSiblingConversationIds({
    conversationId: params.conversationId,
    myPublicKeyHex: params.normalizedPublicKeyHex,
  }).filter((candidateId) => candidateId !== params.conversationId);

  let siblingOutgoingCount = 0;
  let siblingIncomingCount = 0;
  let siblingWithOutgoingCount = 0;
  const siblingSamples: string[] = [];

  for (const siblingConversationId of siblingConversationIds) {
    const siblingRows = await loadConversationWindow({
      conversationId: siblingConversationId,
      limit: params.initialBatchSize,
    });
    if (siblingRows.length === 0) {
      continue;
    }
    const siblingMessages = siblingRows.slice().reverse().map((entry: any) => (
      params.normalizeIndexedRowToMessage(entry, siblingConversationId)
    ));
    const siblingCounts = getMessageDirectionCounts(siblingMessages, params.normalizedPublicKeyHex);
    siblingOutgoingCount += siblingCounts.outgoing;
    siblingIncomingCount += siblingCounts.incoming;
    if (siblingCounts.outgoing > 0) {
      siblingWithOutgoingCount += 1;
      if (siblingSamples.length < 3) {
        siblingSamples.push(
          `${toConversationIdDiagnosticLabel(siblingConversationId)}:${siblingCounts.outgoing}/${siblingCounts.incoming}`,
        );
      }
    }
  }

  if (siblingOutgoingCount > 0) {
    logAppEvent({
      name: "messaging.conversation_hydration_id_split_detected",
      level: "warn",
      scope: { feature: "messaging", action: "conversation_hydrate" },
      context: {
        conversationIdHint: toConversationIdDiagnosticLabel(params.conversationId),
        indexedIncomingOnlyCount: mappedDirectionCounts.incoming,
        siblingConversationCount: siblingConversationIds.length,
        siblingWithOutgoingCount,
        siblingOutgoingCount,
        siblingIncomingCount,
        siblingSample: siblingSamples.join(",") || null,
        projectionReadAuthorityReason: params.projectionReadAuthoritySnapshot.reason,
        criticalDriftCount: params.projectionReadAuthoritySnapshot.criticalDriftCount,
      },
    });
  }
}
