import {
  buildClientGateway,
  type ClientPlatform,
} from "@dweb/client-gateway";
import { communityRosterMaterializationOwner } from "@/app/features/groups/services/community-roster-materialization-owner";
import { communityMembershipPortOwner } from "@/app/features/groups/services/community-membership-port-owner";
import { communityTransportOwner } from "@/app/features/groups/services/community-transport-owner";
import { dmConversationMaterializationOwner } from "@/app/features/messaging/services/dm-conversation-materialization-owner";
import type { AppClientGateway } from "@/app/features/runtime/types/app-client-gateway";
import {
  DESKTOP_TAURI_CAPABILITIES,
  PWA_GENERIC_WEB_CAPABILITIES,
  type ClientStorageCapabilities,
} from "@dweb/storage-contracts/runtime-capabilities";
import { localDmVisibilityOwner } from "@/app/features/messaging/local-dm-visibility";
import type { StoragePorts } from "@/app/features/profiles/types/storage-ports";
import { getRuntimeCapabilities } from "@/app/features/runtime/runtime-capabilities";

export const resolveClientPlatform = (): ClientPlatform => {
  const runtime = getRuntimeCapabilities();
  if (runtime.isMobile) {
    return "mobile";
  }
  if (runtime.isDesktop) {
    return "desktop";
  }
  return "web";
};

export const resolveClientStorageCapabilities = (): ClientStorageCapabilities => (
  getRuntimeCapabilities().isNativeRuntime
    ? DESKTOP_TAURI_CAPABILITIES
    : PWA_GENERIC_WEB_CAPABILITIES
);

/** Assemble the unified gateway from injected storage ports + canonical domain owners. */
export const buildAppClientGateway = (params: Readonly<{
  profileId: string;
  storagePorts: StoragePorts;
  publicKeyHex?: string | null;
}>): AppClientGateway => ({
  ...buildClientGateway({
    profileId: params.profileId,
    publicKeyHex: params.publicKeyHex ?? null,
    platform: resolveClientPlatform(),
    capabilities: resolveClientStorageCapabilities(),
    messageDeleteTombstones: params.storagePorts.messageDeleteTombstones,
    localDmVisibility: localDmVisibilityOwner,
  }),
  dmConversationMaterialization: dmConversationMaterializationOwner,
  communityRoster: communityRosterMaterializationOwner,
  communityTransport: communityTransportOwner,
  communityMembership: communityMembershipPortOwner,
});
