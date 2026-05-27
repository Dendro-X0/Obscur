/**
 * App-layer gateway extensions (R1/R2).
 */
import type { ClientGateway } from "./client-gateway";
import type { CommunityMembershipPort } from "./community-membership-port-contract";
import type { TransportPort } from "./community-transport-port-contract";
import type { CommunityRosterMaterializationPortContract } from "./community-roster-port-contract";
import type {
  DmConversationMaterializationPortContract,
  DmHydrateThreadReadModelResultContract,
} from "./dm-materialization-port-contract";

export type {
  CommunityRosterMaterializationPortContract,
  DmConversationMaterializationPortContract,
  DmHydrateThreadReadModelResultContract,
};

export type AppClientGatewayExtensions<
  TDm = DmConversationMaterializationPortContract,
  TRoster = CommunityRosterMaterializationPortContract,
  TTransport = TransportPort,
  TMembership = CommunityMembershipPort,
> = Readonly<{
  dmConversationMaterialization: TDm;
  communityRoster: TRoster;
  communityTransport: TTransport;
  communityMembership: TMembership;
}>;

/** Base gateway + materialization/roster ports (app binds concrete `TDm` / `TRoster`). */
export type FullClientGateway<
  TDm = DmConversationMaterializationPortContract,
  TRoster = CommunityRosterMaterializationPortContract,
  TTransport = TransportPort,
  TMembership = CommunityMembershipPort,
> = ClientGateway & AppClientGatewayExtensions<TDm, TRoster, TTransport, TMembership>;
