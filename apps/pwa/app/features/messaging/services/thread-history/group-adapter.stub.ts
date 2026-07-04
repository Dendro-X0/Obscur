import type { Message } from "../../types";
import type { AssembleDmHydrateThreadReadModelResult } from "./hydrate-read-model-types";
import type { ThreadHistoryPort } from "./port";

const emptyHydrateResult = (): AssembleDmHydrateThreadReadModelResult => ({
  finalMessages: [],
  authorityDecision: { authority: "indexed", reason: "indexed_primary" },
  hasEarlier: false,
  projectionFallbackHydration: false,
  authorityDiagnosticKey: "thread-history:group-stub",
  authorityLogContext: {},
  hydrationDiagnosticsLogContext: null,
  hydrated: [],
  mappedDirectionCounts: { outgoing: 0, incoming: 0 },
});

/**
 * Visual-only group thread adapter — empty history until group-v2 backend plugs in.
 */
export const groupThreadHistoryAdapterStub: ThreadHistoryPort = {
  prepareThreadSuppressionIds: async () => new Set<string>(),
  hydrateThreadReadModel: async () => emptyHydrateResult(),
  buildProjectionEvidenceMessages: () => [],
  mergeProjectionWithLiveOverlay: (params) => ({
    retentionFilteredNextMessages: params.previousMessages,
    shouldCapToLiveWindow: false,
    mergedMessageCount: params.previousMessages.length,
    cappedMessageCount: params.previousMessages.length,
  }),
  loadEarlierMessages: async (params) => ({
    messages: params.existingMessages,
    hasEarlier: false,
    didExpandHistory: false,
  }),
  applyRealtimeBufferedEvents: (params) => [...params.previous],
  filterThreadMessagesBySuppression: (messages) => [...messages],
  mergeHydratedBaseWithLiveOverlay: (baseHydrated, liveOverlay, scope) => {
    const byId = new Map<string, Message>();
    baseHydrated.forEach((message) => byId.set(message.id, message));
    liveOverlay.forEach((message) => {
      const conversationId = message.conversationId?.trim() ?? "";
      if (conversationId && !scope.has(conversationId)) {
        return;
      }
      if (!byId.has(message.id)) {
        byId.set(message.id, message);
      }
    });
    return Array.from(byId.values());
  },
};
