import type {
  CommunityControlHandler,
  PublishResult,
  TransportPort,
  Unsubscribe,
} from "@dweb/transport-contracts";

export type CreateNostrTransportAdapterParams = Readonly<{
  /**
   * B0: ingress mapping lives in {@link mapSealedControlPayloadToSemanticCommunityEvent};
   * publish/subscribe wire-up lands in v1.9.1+.
   */
  onSubscribe?: (handler: CommunityControlHandler) => Unsubscribe;
  onPublish?: TransportPort["publishCommunityControl"];
}>;

const noopUnsubscribe: Unsubscribe = () => {};

const notWiredPublish = async (): Promise<PublishResult> => ({
  success: false,
  errorMessage: "nostr_transport_publish_not_wired_v1_9_0",
});

/**
 * Nostr transport adapter (B0 boundary).
 * Sealed control ingress is mapped in the feature hook until subscribe is centralized in B1.
 */
export const createNostrTransportAdapter = (
  params: CreateNostrTransportAdapterParams = {},
): TransportPort => ({
  kind: "nostr",
  publishCommunityControl: params.onPublish ?? notWiredPublish,
  subscribeCommunityControl: params.onSubscribe ?? (() => noopUnsubscribe),
});
