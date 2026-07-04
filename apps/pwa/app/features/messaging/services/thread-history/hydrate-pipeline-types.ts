/**
 * Thread history hydrate pipeline contracts — shared by port, gateway, and legacy impl.
 */
import type { AccountProjectionRuntimeSnapshot } from "@/app/features/account-sync/account-event-contracts";
import type { ProjectionReadAuthority } from "@/app/features/account-sync/services/account-projection-read-authority";
import type { MessageDeleteTombstonesPersistencePort } from "@/app/features/profiles/types/storage-ports";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { Message } from "../../types";

export type DmConversationHydratePipelineNumericConfig = Readonly<{
  initialBatchSize: number;
  initialHydrationVisibleTarget: number;
  maxHydrationScanPasses: number;
  liveWindowSoftLimit: number;
}>;

export type RunDmConversationHydrateReadModelPipelineParams = Readonly<{
  conversationId: string;
  conversationIds: ReadonlyArray<string>;
  profileIdForTombstones: string | undefined;
  messageDeleteTombstones: MessageDeleteTombstonesPersistencePort;
  /** Mutated in place: durable + in-flight tombstone ids for this hydrate pass */
  persistedDeletedIds: Set<string>;
  publicKeyHex: PublicKeyHex | string | null;
  normalizedPublicKeyHex: PublicKeyHex | null;
  localMessageRetentionDays: number | undefined;
  numeric: DmConversationHydratePipelineNumericConfig;
  projectionMessagesSnapshot: ReadonlyArray<Message>;
  projectionEvidenceMessagesSnapshot: ReadonlyArray<Message>;
  projectionReadAuthoritySnapshot: ProjectionReadAuthority;
  accountProjectionPhase: AccountProjectionRuntimeSnapshot["phase"];
  accountProjection: AccountProjectionRuntimeSnapshot["projection"];
  accountProjectionReady: AccountProjectionRuntimeSnapshot["accountProjectionReady"];
  liveMessages: ReadonlyArray<Message>;
  expandedHistory: boolean;
  /** When set, hydrate telemetry logs only on authority key change. */
  previousAuthorityDiagnosticKey?: string | null;
  /** When true, hydrate uses sqlite/indexed authority even if projection read cutover is enabled. */
  preferIndexedAuthority?: boolean;
}>;
