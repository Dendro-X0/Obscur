import type {
  CommunityControlHandler,
  PublishResult,
  SemanticCommunityEvent,
  TransportPort,
  Unsubscribe,
} from "@dweb/transport-contracts";

export type TeamRelayTransportCallbacks = Readonly<{
  relayUrl: string;
  publish?: (params: Readonly<{
    relayUrl: string;
    event: SemanticCommunityEvent;
  }>) => Promise<PublishResult>;
  subscribe?: (params: Readonly<{
    relayUrl: string;
    handler: CommunityControlHandler;
  }>) => Unsubscribe;
}>;

const noopUnsubscribe: Unsubscribe = () => {};

const notWiredPublish = async (): Promise<PublishResult> => ({
  success: false,
  errorMessage: "team_relay_publish_not_wired",
});

/**
 * Transport scoped to a single community relay URL (Path B team transport).
 * Membership authority remains on coordination; this port carries sealed control on the team relay.
 */
export const createTeamRelayTransportAdapter = (
  callbacks: TeamRelayTransportCallbacks,
): TransportPort => ({
  kind: "team_relay",
  publishCommunityControl: callbacks.publish
    ? async (event) => callbacks.publish!({ relayUrl: callbacks.relayUrl, event })
    : notWiredPublish,
  subscribeCommunityControl: (handler) => (
    callbacks.subscribe
      ? callbacks.subscribe({ relayUrl: callbacks.relayUrl, handler })
      : noopUnsubscribe
  ),
});
