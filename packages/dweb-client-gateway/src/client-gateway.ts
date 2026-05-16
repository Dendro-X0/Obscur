import type { ClientStorageCapabilities } from "@dweb/storage-contracts/runtime-capabilities";
import type { ProfileId, PublicKeyHex } from "@dweb/storage-contracts/scoped-context";
import type { ClientPlatform } from "./client-platform";
import type { LocalDmVisibilityPort } from "./local-dm-visibility-port";
import type { MessageDeleteTombstonesPersistencePort } from "./message-delete-tombstones-port";

/**
 * Single client-side integration surface for product mutations and local read models.
 *
 * Rule: Web / PWA / desktop / mobile must not branch on `isTauri` (or similar) in feature
 * code — route through this gateway (or a port it exposes). Platform adapters install once
 * at runtime bootstrap (`ProfileRuntimeProvider`).
 */
export type ClientGateway = Readonly<{
  profileId: ProfileId;
  publicKeyHex: PublicKeyHex | null;
  platform: ClientPlatform;
  capabilities: ClientStorageCapabilities;
  messageDeleteTombstones: MessageDeleteTombstonesPersistencePort;
  localDmVisibility: LocalDmVisibilityPort;
}>;

export type BuildClientGatewayParams = Readonly<{
  profileId: ProfileId;
  publicKeyHex?: PublicKeyHex | null;
  platform: ClientPlatform;
  capabilities: ClientStorageCapabilities;
  messageDeleteTombstones: MessageDeleteTombstonesPersistencePort;
  localDmVisibility: LocalDmVisibilityPort;
}>;

export const buildClientGateway = (params: BuildClientGatewayParams): ClientGateway => ({
  profileId: params.profileId,
  publicKeyHex: params.publicKeyHex ?? null,
  platform: params.platform,
  capabilities: params.capabilities,
  messageDeleteTombstones: params.messageDeleteTombstones,
  localDmVisibility: params.localDmVisibility,
});
