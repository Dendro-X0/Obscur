import type { NostrEvent } from "@dweb/nostr/nostr-event";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type {
  Attachment,
  ConnectionRequestStatusValue,
  Message,
  RequestSendBlockReason,
  MessageActionFailureReason,
} from "@/app/features/messaging/types";

// ---------------------------------------------------------------------------
// Relay transport
// ---------------------------------------------------------------------------

export type RelayPublishOutcome = Readonly<{
  relayUrl: string;
  success: boolean;
  error?: string;
  latencyMs?: number;
  latency?: number;
}>;

export type PublishResult = Readonly<{
  success: boolean;
  successCount: number;
  totalRelays: number;
  outcomes: ReadonlyArray<RelayPublishOutcome>;
  overallError?: string;
}>;

export type NostrFilter = Readonly<{
  kinds?: ReadonlyArray<number>;
  authors?: ReadonlyArray<string>;
  "#p"?: ReadonlyArray<string>;
  since?: number;
  until?: number;
  limit?: number;
  ids?: ReadonlyArray<string>;
  search?: string;
  "#code"?: ReadonlyArray<string>;
  "#t"?: ReadonlyArray<string>;
}>;

export type RelayConnection = Readonly<{
  url: string;
  status: string;
  [key: string]: unknown;
}>;

// ---------------------------------------------------------------------------
// Pool contract — what we require from the relay pool
// ---------------------------------------------------------------------------

export type RelayPoolContract = Readonly<{
  connections: ReadonlyArray<RelayConnection>;
  sendToOpen: (payload: string) => void;
  publishToUrls?: (urls: ReadonlyArray<string>, payload: string) => Promise<MultiRelayPublishResult>;
  publishToAll?: (payload: string) => Promise<MultiRelayPublishResult>;
  subscribeToMessages: (handler: (params: Readonly<{ url: string; message: string }>) => void) => () => void;
  subscribe: (filters: ReadonlyArray<NostrFilter>, onEvent: (event: NostrEvent, url: string) => void) => string;
  unsubscribe: (id: string) => void;
  addTransientRelay?: (url: string) => void;
  removeTransientRelay?: (url: string) => void;
  resubscribeAll?: () => void;
  waitForConnection: (timeoutMs: number) => Promise<boolean>;
  waitForScopedConnection?: (relayUrls: ReadonlyArray<string>, timeoutMs: number) => Promise<boolean>;
  getWritableRelaySnapshot?: (scopedRelayUrls?: ReadonlyArray<string>) => {
    writableRelayUrls: ReadonlyArray<string>;
    [key: string]: unknown;
  };
  isConnected?: () => boolean;
}>;

// Legacy result shape the pool returns
export interface MultiRelayPublishResult {
  success: boolean;
  successCount: number;
  totalRelays: number;
  metQuorum?: boolean;
  quorumRequired?: number;
  results: Array<{
    relayUrl: string;
    success: boolean;
    error?: string;
    latency?: number;
  }>;
  failures?: Array<{
    relayUrl: string;
    success: boolean;
    error?: string;
    latency?: number;
  }>;
  overallError?: string;
}

// ---------------------------------------------------------------------------
// Send pipeline
// ---------------------------------------------------------------------------

export type DmFormat = "nip17" | "nip04";

export type SendParams = Readonly<{
  peerPublicKeyHex: PublicKeyHex;
  plaintext: string;
  attachments?: ReadonlyArray<Attachment>;
  replyTo?: string;
  customTags?: ReadonlyArray<ReadonlyArray<string>>;
}>;

export type SendResult = Readonly<{
  success: boolean;
  deliveryStatus: "sent_quorum" | "sent_partial" | "queued_retrying" | "failed";
  messageId: string;
  eventId: string;
  relayResults: ReadonlyArray<RelayPublishOutcome>;
  error?: string;
  failureReason?: MessageActionFailureReason;
  blockReason?: RequestSendBlockReason;
  retryAtUnixMs?: number;
}>;

// ---------------------------------------------------------------------------
// Receive pipeline
// ---------------------------------------------------------------------------

export type IncomingEventContext = Readonly<{
  event: NostrEvent;
  relayUrl: string;
  ingestSource: "relay_live" | "relay_sync";
}>;

export type DecryptedIncomingDm = Readonly<{
  eventId: string;
  senderPubkey: PublicKeyHex;
  recipientPubkey: PublicKeyHex;
  plaintext: string;
  createdAtUnixSeconds: number;
  isSelfAuthored: boolean;
  relayUrl: string;
  ingestSource: "relay_live" | "relay_sync";
  tags: ReadonlyArray<ReadonlyArray<string>>;
}>;

// ---------------------------------------------------------------------------
// Delete pipeline
// ---------------------------------------------------------------------------

export type DeleteParams = Readonly<{
  targetMessageIds: ReadonlyArray<string>;
  conversationId: string;
  peerPublicKeyHex: PublicKeyHex;
}>;

export type DeleteResult = Readonly<{
  success: boolean;
  deletedMessageIds: ReadonlyArray<string>;
  error?: string;
}>;

// ---------------------------------------------------------------------------
// Controller state
// ---------------------------------------------------------------------------

export type DmControllerState = Readonly<{
  phase: "idle" | "ready" | "error";
  messages: ReadonlyArray<Message>;
  error?: string;
}>;

// ---------------------------------------------------------------------------
// Controller identity params
// ---------------------------------------------------------------------------

export type IdentityParams = Readonly<{
  myPublicKeyHex: PublicKeyHex | null;
  myPrivateKeyHex: PrivateKeyHex | null;
}>;

// ---------------------------------------------------------------------------
// Peer trust / requests inbox contracts
// ---------------------------------------------------------------------------

export type PeerTrustContract = Readonly<{
  isAccepted: (params: Readonly<{ publicKeyHex: string }>) => boolean;
  acceptPeer: (params: Readonly<{ publicKeyHex: string }>) => void;
}>;

export type RequestsInboxContract = Readonly<{
  getRequestStatus: (params: Readonly<{ peerPublicKeyHex: string }>) => Readonly<{
    status?: ConnectionRequestStatusValue;
    isOutgoing: boolean;
  }> | null;
  setStatus: (params: Readonly<{
    peerPublicKeyHex: string;
    status: ConnectionRequestStatusValue;
    isOutgoing?: boolean;
  }>) => void;
}>;

export type BlocklistContract = Readonly<{
  isBlocked: (params: Readonly<{ publicKeyHex: string }>) => boolean;
}>;
