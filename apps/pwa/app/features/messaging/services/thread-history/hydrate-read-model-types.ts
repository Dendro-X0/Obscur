/**
 * Thread history hydrate read-model contracts — shared by port, group adapter, and legacy impl.
 */
import type { ProjectionReadAuthority } from "@/app/features/account-sync/services/account-projection-read-authority";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { Message } from "../../types";
import type { ConversationHistoryAuthorityDecision } from "./hydrate-authority-types";

type AppEventLogContext = Readonly<Record<string, string | number | boolean | null>>;

export type AssembleDmHydrateThreadReadModelParams = Readonly<{
  conversationId: string;
  conversationIds: ReadonlyArray<string>;
  retentionFilteredMapped: ReadonlyArray<Message>;
  cappedHydratedMessages: ReadonlyArray<Message>;
  scannedWindowHasEarlier: boolean;
  shouldCapHydratedHistoryWindow: boolean;
  normalizedPublicKeyHex: PublicKeyHex | null;
  projectionMessagesSnapshot: ReadonlyArray<Message>;
  projectionEvidenceMessagesSnapshot: ReadonlyArray<Message>;
  projectionReadAuthoritySnapshot: ProjectionReadAuthority;
  projectionRestorePhaseActive: boolean;
  projectionBootstrapImportApplied: boolean;
  projectionCanonicalEvidencePending: boolean;
  persistedStateFallbackMessages: ReadonlyArray<Message>;
  liveMessages: ReadonlyArray<Message>;
  expandedHistory: boolean;
  persistentSuppressedMessageIds: ReadonlySet<string>;
  liveWindowSoftLimit: number;
}>;

export type AssembleDmHydrateThreadReadModelResult = Readonly<{
  finalMessages: ReadonlyArray<Message>;
  authorityDecision: ConversationHistoryAuthorityDecision;
  hasEarlier: boolean;
  projectionFallbackHydration: boolean;
  authorityDiagnosticKey: string;
  authorityLogContext: AppEventLogContext;
  hydrationDiagnosticsLogContext: AppEventLogContext | null;
  hydrated: ReadonlyArray<Message>;
  mappedDirectionCounts: Readonly<{ outgoing: number; incoming: number }>;
}>;
