/**
 * R1 — hydrate durable tombstones + projection removals into one suppression set.
 * Single prep path for hydrate pipeline and `use-conversation-messages`.
 */

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { isTauri } from "@dweb/db";
import type { AccountProjectionSnapshot } from "@/app/features/account-sync/account-event-contracts";
import type { MessageDeleteTombstonesPersistencePort } from "@/app/features/profiles/types/storage-ports";
import { messagingClientOperations } from "./messaging-client-operations";
import { buildDmThreadSuppressionIdSet } from "./dm-thread-suppression-set";

export type PrepareDmThreadSuppressionParams = Readonly<{
  profileId: string | undefined;
  accountPublicKeyHex: PublicKeyHex | null | undefined;
  projection: AccountProjectionSnapshot | null | undefined;
  messageDeleteTombstones: MessageDeleteTombstonesPersistencePort;
  /** Unioned with durable + projection ids (in-flight deletes before SQLite flush). */
  seedIds?: ReadonlySet<string>;
}>;

/**
 * Loads durable tombstones, merges projection `removedMessageIds`, returns a mutable set
 * suitable for `persistedDeletedIds` refs and hydrate pipeline input.
 *
 * Slice 3g: `ensureReady` already hydrates SQLite tombstones — do not re-list / re-hydrate here.
 */
export const prepareDmThreadSuppressionIds = async (
  params: PrepareDmThreadSuppressionParams,
): Promise<Set<string>> => {
  const profileId = params.profileId?.trim() || undefined;
  const target = new Set<string>(params.seedIds ?? []);

  if (profileId && params.accountPublicKeyHex) {
    await messagingClientOperations.ensureLocalDmVisibilityReady({
      profileId,
      accountPublicKeyHex: params.accountPublicKeyHex,
    }).catch(() => {});
  } else if (profileId) {
    if (isTauri()) {
      await params.messageDeleteTombstones.hydrateMessageDeleteTombstonesFromSqlite(profileId).catch(() => {});
    } else {
      await params.messageDeleteTombstones.mergeMessageDeleteTombstonesFromIndexedDb(profileId).catch(() => {});
    }
  }

  params.messageDeleteTombstones.loadSuppressedMessageDeleteIds(Date.now(), profileId).forEach((id) => {
    target.add(id);
  });

  buildDmThreadSuppressionIdSet({
    durableSuppressedIds: target,
    projection: params.projection,
  }).forEach((id) => target.add(id));

  return target;
};
