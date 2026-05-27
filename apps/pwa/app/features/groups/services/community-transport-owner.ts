import { createNostrTransportAdapter } from "@dweb/transport-nostr";
import type { TransportPort } from "@dweb/transport-contracts";

/**
 * Default gateway transport (Nostr). Per-community team relay ports are built via
 * `createCommunityTeamRelayTransport` for `managed_workspace` communities (v1.9.0 phase 3).
 */
export const communityTransportOwner: TransportPort = createNostrTransportAdapter();
