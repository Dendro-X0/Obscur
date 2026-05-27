import type {
  CommunityControlHandler,
  PublishResult,
  SemanticCommunityEvent,
  TransportPort,
  Unsubscribe,
} from "@dweb/transport-contracts";
import { isSemanticCommunityMemberEvent } from "@dweb/transport-contracts";

export type CoordinationTransportCallbacks = Readonly<{
  publish?: (event: SemanticCommunityEvent) => Promise<PublishResult>;
  subscribe?: (handler: CommunityControlHandler) => Unsubscribe;
}>;

const noopUnsubscribe: Unsubscribe = () => {};

export const createCoordinationTransportAdapter = (
  callbacks: CoordinationTransportCallbacks = {},
): TransportPort => ({
  kind: "obscur_coordination",
  publishCommunityControl: callbacks.publish ?? (async () => ({
    success: false,
    errorMessage: "coordination_publish_not_wired",
  })),
  subscribeCommunityControl: (handler) => {
    if (!callbacks.subscribe) {
      return noopUnsubscribe;
    }
    return callbacks.subscribe((event) => {
      if (isSemanticCommunityMemberEvent(event)) {
        handler(event);
      }
    });
  },
});
