import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

export type AccountEventType =
  | "CONTACT_REQUEST_RECEIVED"
  | "CONTACT_REQUEST_SENT"
  | "CONTACT_ACCEPTED"
  | "CONTACT_DECLINED"
  | "CONTACT_CANCELED"
  | "CONTACT_REMOVED"
  | "DM_RECEIVED"
  | "DM_SENT_CONFIRMED"
  | "DM_DECRYPT_FAILED_QUARANTINED"
  | "SYNC_CHECKPOINT_ADVANCED"
  | "BOOTSTRAP_IMPORT_APPLIED";

export type AccountEventSource =
  | "local_bootstrap"
  | "relay_live"
  | "relay_sync"
  | "legacy_bridge";

type ContactDirection = "incoming" | "outgoing" | "unknown";

type AccountEventBase = Readonly<{
  type: AccountEventType;
  eventId: string;
  profileId: string;
  accountPublicKeyHex: PublicKeyHex;
  source: AccountEventSource;
  observedAtUnixMs: number;
  causationKey?: string;
  idempotencyKey: string;
}>;

export type ContactRequestReceivedEvent = AccountEventBase & Readonly<{
  type: "CONTACT_REQUEST_RECEIVED";
  peerPublicKeyHex: PublicKeyHex;
  direction: ContactDirection;
  requestEventId?: string;
}>;

export type ContactRequestSentEvent = AccountEventBase & Readonly<{
  type: "CONTACT_REQUEST_SENT";
  peerPublicKeyHex: PublicKeyHex;
  direction: ContactDirection;
  requestEventId?: string;
}>;

export type ContactAcceptedEvent = AccountEventBase & Readonly<{
  type: "CONTACT_ACCEPTED";
  peerPublicKeyHex: PublicKeyHex;
  direction: ContactDirection;
  requestEventId?: string;
}>;

export type ContactDeclinedEvent = AccountEventBase & Readonly<{
  type: "CONTACT_DECLINED";
  peerPublicKeyHex: PublicKeyHex;
  direction: ContactDirection;
  requestEventId?: string;
}>;

export type ContactCanceledEvent = AccountEventBase & Readonly<{
  type: "CONTACT_CANCELED";
  peerPublicKeyHex: PublicKeyHex;
  direction: ContactDirection;
  requestEventId?: string;
}>;

export type ContactRemovedEvent = AccountEventBase & Readonly<{
  type: "CONTACT_REMOVED";
  peerPublicKeyHex: PublicKeyHex;
  direction: ContactDirection;
}>;

export type DmReceivedEvent = AccountEventBase & Readonly<{
  type: "DM_RECEIVED";
  peerPublicKeyHex: PublicKeyHex;
  conversationId: string;
  messageId: string;
  eventCreatedAtUnixSeconds: number;
  plaintextPreview: string;
}>;

export type DmSentConfirmedEvent = AccountEventBase & Readonly<{
  type: "DM_SENT_CONFIRMED";
  peerPublicKeyHex: PublicKeyHex;
  conversationId: string;
  messageId: string;
  eventCreatedAtUnixSeconds: number;
  plaintextPreview: string;
}>;

export type DmDecryptFailedQuarantinedEvent = AccountEventBase & Readonly<{
  type: "DM_DECRYPT_FAILED_QUARANTINED";
  peerPublicKeyHex: PublicKeyHex;
  messageId: string;
  reason: string;
}>;

export type SyncCheckpointAdvancedEvent = AccountEventBase & Readonly<{
  type: "SYNC_CHECKPOINT_ADVANCED";
  timelineKey: string;
  lastProcessedAtUnixSeconds: number;
}>;

export type BootstrapImportAppliedEvent = AccountEventBase & Readonly<{
  type: "BOOTSTRAP_IMPORT_APPLIED";
  sourceCounts: Readonly<Record<AccountEventSource, number>>;
  dedupeCount: number;
}>;

export type AccountEvent =
  | ContactRequestReceivedEvent
  | ContactRequestSentEvent
  | ContactAcceptedEvent
  | ContactDeclinedEvent
  | ContactCanceledEvent
  | ContactRemovedEvent
  | DmReceivedEvent
  | DmSentConfirmedEvent
  | DmDecryptFailedQuarantinedEvent
  | SyncCheckpointAdvancedEvent
  | BootstrapImportAppliedEvent;

export type ContactProjectionStatus =
  | "none"
  | "pending"
  | "accepted"
  | "declined"
  | "canceled";

export type ContactProjection = Readonly<{
  peerPublicKeyHex: PublicKeyHex;
  status: ContactProjectionStatus;
  direction: ContactDirection;
  lastEvidenceAtUnixMs: number;
  lastEventId: string;
  lastRequestEventId?: string;
}>;

export type ConversationProjection = Readonly<{
  conversationId: string;
  peerPublicKeyHex: PublicKeyHex;
  lastMessagePreview: string;
  lastMessageAtUnixMs: number;
  unreadCount: number;
}>;

export type MessageProjection = Readonly<{
  messageId: string;
  conversationId: string;
  peerPublicKeyHex: PublicKeyHex;
  direction: "incoming" | "outgoing";
  eventCreatedAtUnixSeconds: number;
  plaintextPreview: string;
  observedAtUnixMs: number;
}>;

export type SyncProjection = Readonly<{
  checkpointsByTimelineKey: Readonly<Record<string, number>>;
  bootstrapImportApplied: boolean;
}>;

export type AccountProjectionSnapshot = Readonly<{
  profileId: string;
  accountPublicKeyHex: PublicKeyHex;
  contactsByPeer: Readonly<Record<string, ContactProjection>>;
  conversationsById: Readonly<Record<string, ConversationProjection>>;
  messagesByConversationId: Readonly<Record<string, ReadonlyArray<MessageProjection>>>;
  sync: SyncProjection;
  lastSequence: number;
  updatedAtUnixMs: number;
}>;

export type DriftReport = Readonly<{
  criticalDriftCount: number;
  nonCriticalDriftCount: number;
  domains: ReadonlyArray<"contacts" | "messages" | "sync">;
  checkedAtUnixMs: number;
}>;

export type BootstrapReport = Readonly<{
  sourceCounts: Readonly<Record<AccountEventSource, number>>;
  dedupeCount: number;
  importApplied: boolean;
}>;

export type AccountProjectionPhase =
  | "idle"
  | "bootstrapping"
  | "replaying_event_log"
  | "ready"
  | "degraded";

export type AccountProjectionStatus = "pending" | "ready" | "degraded";

export type AccountProjectionRuntimeSnapshot = Readonly<{
  profileId: string | null;
  accountPublicKeyHex: PublicKeyHex | null;
  projection: AccountProjectionSnapshot | null;
  phase: AccountProjectionPhase;
  status: AccountProjectionStatus;
  accountProjectionReady: boolean;
  driftStatus: "unknown" | "clean" | "drifted";
  driftReport?: DriftReport;
  bootstrapReport?: BootstrapReport;
  lastError?: string;
  updatedAtUnixMs: number;
}>;
