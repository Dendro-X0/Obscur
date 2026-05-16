/**
 * Message Deletion Module
 *
 * Delete-for-everyone + remote ingest: coordinator + tombstone store + codec.
 * Delete-for-me: `localDmVisibility` via gateway (R1); avoid `deleteMessageForMe`.
 */

// Types
export type {
  TombstoneId,
  MessageIdentity,
  DeleteScope,
  DeleteReason,
  MessageTombstone,
  LocalMessageTombstone,
  NetworkMessageTombstone,
  DmDeleteCommandV1,
  CommunityDeleteCommandV1,
  DeleteCommandV1,
  DeleteForMeIntent,
  DeleteForEveryoneIntent,
  RemoteDeleteCommand,
  MessageVisibilityContext,
  MessageDeletedEvent,
  MessageDeletionFailedEvent,
} from "./types";

// Coordinator (delete-for-everyone + remote ingest; delete-for-me is localDmVisibility)
export {
  registerDeletionEventBus,
  /** @deprecated Use gateway `localDmVisibility.executeDeleteForMe`. */
  deleteMessageForMe,
  deleteMessageForEveryone,
  commitNetworkDeleteTombstone,
  updateNetworkTombstoneEvidence,
  ingestRemoteDeleteCommand,
  ingestDmDeleteFromResolvedTargets,
  processIncomingDmDeleteCommand,
  processIncomingCommunityDeleteCommand,
  canDeleteForMe,
  canDeleteForEveryone,
} from "./message-deletion-coordinator";

// Tombstone store
export {
  generateTombstoneId,
  loadMessageTombstones,
  saveMessageTombstones,
  upsertMessageTombstone,
  bulkUpsertMessageTombstones,
  removeMessageTombstone,
  clearMessageTombstones,
  findTombstonesForConversation,
  findTombstonesForMessageIds,
  isMessageTombstoned,
  getLocalTombstones,
  getNetworkTombstones,
  findTombstoneByCommandEventId,
  exportTombstonesForSync,
  importTombstonesFromSync,
} from "./message-tombstone-store";

// Visible message selector
export type { SelectableMessage, VisibleMessageSelection } from "./visible-message-selector";
export {
  selectVisibleMessages,
  isMessageVisible,
  findHidingTombstones,
  isDeletedByCurrentUser,
  isDeletedForMeOnly,
  selectDeletedMessageIds,
  filterMessagesForConversation,
  preFilterMessagesForSync,
  countTombstonesByScope,
} from "./visible-message-selector";

// Message identity resolver
export type { MessageIdentityInput } from "./message-identity-resolver";
export {
  resolveMessageIdentity,
  messageMatchesIdentityIds,
  identitiesReferToSameMessage,
  mergeMessageIdentityAliases,
  tombstoneMatchesMessage,
  findMatchingIdentityId,
  extractIdentityIdsFromDmEvent,
  buildIdentityIdSet,
} from "./message-identity-resolver";

// Delete command codec
export {
  encodeDmDeleteCommandV1,
  decodeDmDeleteCommandV1,
  decodeDmDeleteCommandLenient,
  encodeCommunityDeleteCommandV1,
  decodeCommunityDeleteCommandV1,
  decodeDeleteCommand,
  isDeleteCommand,
  extractDeleteCommandTargetIds,
  extractDeleteCommandSender,
  extractDeleteCommandConversationId,
} from "./delete-command-codec";
