/**
 * App-layer gateway extensions (R1/R2).
 */
import type { ClientGateway } from "./client-gateway";
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
> = Readonly<{
  dmConversationMaterialization: TDm;
  communityRoster: TRoster;
}>;

/** Base gateway + materialization/roster ports (app binds concrete `TDm` / `TRoster`). */
export type FullClientGateway<
  TDm = DmConversationMaterializationPortContract,
  TRoster = CommunityRosterMaterializationPortContract,
> = ClientGateway & AppClientGatewayExtensions<TDm, TRoster>;
