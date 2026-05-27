import type {
  SemanticCommunityEvent,
  TransportKind,
} from "./semantic-community-events";

export type PublishResult = Readonly<{
  success: boolean;
  errorMessage?: string;
}>;

export type Unsubscribe = () => void;

export type CommunityControlHandler = (event: SemanticCommunityEvent) => void;

/**
 * Transport adapter surface — Nostr, coordination backend, or team relay.
 * Kernel consumes semantic events; adapters map wire formats only.
 */
export type TransportPort = Readonly<{
  readonly kind: TransportKind;
  publishCommunityControl(event: SemanticCommunityEvent): Promise<PublishResult>;
  subscribeCommunityControl(handler: CommunityControlHandler): Unsubscribe;
}>;
