export type { MessageDeleteTombstonesPersistencePort } from "@dweb/client-gateway/message-delete-tombstones";

import type { MessageDeleteTombstonesPersistencePort } from "@dweb/client-gateway/message-delete-tombstones";

/**
 * Injectable persistence surface for DM delete-for-me tombstones (Phase 2).
 * Prefer routing feature code through `getResolvedClientGateway().messageDeleteTombstones`.
 */
export type StoragePorts = Readonly<{
  messageDeleteTombstones: MessageDeleteTombstonesPersistencePort;
}>;
