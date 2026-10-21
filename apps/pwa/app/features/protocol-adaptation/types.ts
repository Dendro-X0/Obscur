/**
 * Protocol adaptation façade types (Phase 0).
 * UI talks only to ProtocolAdaptationLayer; adapter internals stay private.
 */

export type ProtocolId = "nostr" | "matrix";

export type TransportId = "clearnet" | "tor" | "quiet";

/**
 * Shell-facing message DTO (Obscur).
 * Do not add Obscur-Nostr wire fields here (`eventId`, pubkey, NIP, relay URL).
 * Those stay on `Message` inside the Nostr module.
 */
export type CanonicalMessage = Readonly<{
  id: string;
  conversationId: string;
  body: string;
  sentAtUnixMs: number;
  direction: "in" | "out";
  status: "sending" | "sent" | "failed" | "delivered";
}>;

export type CanonicalConversation = Readonly<{
  id: string;
  title: string;
}>;

export type ProtocolCapabilities = Readonly<{
  dms: boolean;
  groups: boolean;
  reactions: boolean;
  media: boolean;
}>;

export type ProtocolAdapter = Readonly<{
  id: ProtocolId;
  capabilities: () => ProtocolCapabilities;
  connect: (transport: TransportId) => Promise<void>;
  disconnect: () => Promise<void>;
  /** Phase 0: profile-scoped list (design omits profileId; native path requires it). */
  listConversations: (profileId: string) => Promise<ReadonlyArray<CanonicalConversation>>;
  listMessages: (params: Readonly<{
    profileId: string;
    conversationId: string;
    myPublicKeyHex: string;
    limit?: number;
    beforeReceivedAt?: number;
  }>) => Promise<ReadonlyArray<CanonicalMessage>>;
  sendMessage: (params: Readonly<{
    conversationId: string;
    body: string;
  }>) => Promise<CanonicalMessage>;
}>;

export const PROTOCOL_IDS: ReadonlyArray<ProtocolId> = ["nostr", "matrix"];
export const TRANSPORT_IDS: ReadonlyArray<TransportId> = ["clearnet", "tor", "quiet"];

/** @deprecated Use SELECTABLE_PROTOCOL_IDS (C2 includes Matrix). */
export const PHASE0_SELECTABLE_PROTOCOL_IDS: ReadonlyArray<ProtocolId> = ["nostr", "matrix"];

/** C2: Nostr + Matrix are selectable (Matrix requires session login). */
export const SELECTABLE_PROTOCOL_IDS: ReadonlyArray<ProtocolId> = ["nostr", "matrix"];

/** Default transport when unset. */
export const PHASE0_ACTIVE_TRANSPORT_ID: TransportId = "clearnet";
