import type {
  PrivateTrustProtocolId,
  PrivateTrustSendFaceResult,
} from "@obscur/private-trust-engine";

export type PrivateTrustConversationRow = Readonly<{
  id: string;
  peerLabel: string;
  preview: string;
  updatedAtUnixMs: number;
}>;

export type PrivateTrustMessageRow = Readonly<{
  id: string;
  conversationId: string;
  body: string;
  direction: "in" | "out";
  sentAtUnixMs: number;
  /** Home ACK accepted ≠ delivered (Cut 0/1 T3). */
  deliveryStatus: "accepted" | "failed" | "pending";
}>;

/**
 * Cut 3.3 — thin home ports. Implementations must be PAL/kernel adapters,
 * never chat-state CRM / LS message queue authority.
 */
export type PrivateTrustHomePorts = Readonly<{
  resolveProtocolId: () => PrivateTrustProtocolId;
  setProtocolId: (protocolId: PrivateTrustProtocolId) => void;
  listConversations: () => Promise<ReadonlyArray<PrivateTrustConversationRow>>;
  listMessages: (conversationId: string) => Promise<ReadonlyArray<PrivateTrustMessageRow>>;
  /**
   * Send via active carrier. Lab/kernel adapter owns T3 wire.
   * Caller must pass the active protocol — silent Nostr while private_dc is refused upstream.
   */
  sendDm: (params: Readonly<{
    conversationId: string;
    body: string;
    carrier: PrivateTrustProtocolId;
  }>) => Promise<PrivateTrustSendFaceResult>;
}>;
