/**
 * R1 — DM conversation materialization port (shared contract).
 * Hydrate params stay app-owned (`RunDmConversationHydrateReadModelPipelineParams`);
 * bind with `FullClientGateway<DmConversationMaterializationPort, …>`.
 */
export type DmHydrateThreadReadModelResultContract<TMessage = unknown> = Readonly<{
  finalMessages: ReadonlyArray<TMessage>;
  hasEarlier: boolean;
  projectionFallbackHydration: boolean;
  authorityDiagnosticKey: string;
}>;

export type DmConversationMaterializationPortContract<TMessage = unknown> = Readonly<{
  prepareThreadSuppressionIds: (params: unknown) => Promise<Set<string>>;
  hydrateThreadReadModel: (params: unknown) => Promise<DmHydrateThreadReadModelResultContract<TMessage>>;
  buildProjectionEvidenceMessages: (params: unknown) => ReadonlyArray<TMessage>;
  mergeProjectionWithLiveOverlay: (params: unknown) => unknown;
  loadEarlierMessages: (params: unknown) => Promise<unknown>;
  applyRealtimeBufferedEvents: (params: unknown) => ReadonlyArray<TMessage>;
}>;
