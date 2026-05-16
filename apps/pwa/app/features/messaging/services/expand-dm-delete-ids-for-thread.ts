import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { Message } from "../types";
import { accountProjectionRuntime } from "@/app/features/account-sync/services/account-projection-runtime";
import { selectProjectionConversationMessages } from "@/app/features/account-sync/services/account-projection-selectors";
import { buildDeleteTargetIdsForDm } from "./dm-delete-target-derivation";
import { gatherDmThreadMessagesForDelete } from "./gather-dm-thread-messages-for-delete";
import { resolveDmRemoteDeleteIdentityIds } from "./resolve-dm-remote-delete-identity-ids";
import { collectMessageIdentityAliases } from "./message-identity-alias-contract";
import { buildDmSiblingConversationIds } from "../utils/dm-conversation-sibling-ids";

/**
 * Expands delete-command ids using every thread message source plus NIP-17 rumor
 * derivation for rows that share targets with visible/hydrated messages.
 */
export const expandDmDeleteIdsForThread = async (params: Readonly<{
  conversationId: string;
  myPublicKeyHex: PublicKeyHex;
  targetMessageIds: ReadonlyArray<string>;
  plaintext?: string;
  localMessages?: ReadonlyArray<Message>;
  overlayMessages?: ReadonlyArray<Message>;
  deleteAuthorPubkey?: PublicKeyHex;
}>): Promise<ReadonlyArray<string>> => {
  const threadMessages = gatherDmThreadMessagesForDelete({
    conversationId: params.conversationId,
    myPublicKeyHex: params.myPublicKeyHex,
    localMessages: params.localMessages,
    overlayMessages: params.overlayMessages,
  });

  const resolved = new Set<string>(
    resolveDmRemoteDeleteIdentityIds({
      targetMessageIds: params.targetMessageIds,
      plaintext: params.plaintext,
      localMessages: threadMessages,
    }),
  );

  const seedTargets = new Set<string>([
    ...params.targetMessageIds,
    ...resolved,
  ]);

  const projection = accountProjectionRuntime.getSnapshot().projection;
  if (projection) {
    const conversationIds = new Set<string>(buildDmSiblingConversationIds({
      conversationId: params.conversationId,
      myPublicKeyHex: params.myPublicKeyHex,
    }));
    for (const cid of conversationIds) {
      for (const row of selectProjectionConversationMessages({
        projection,
        conversationId: cid,
        myPublicKeyHex: params.myPublicKeyHex,
        limit: 500,
      })) {
        const aliases = collectMessageIdentityAliases(row);
        if (!aliases.some((alias) => seedTargets.has(alias))) {
          continue;
        }
        for (const alias of aliases) {
          resolved.add(alias);
        }
      }
    }
  }

  const targetSet = new Set(resolved);
  const author = params.deleteAuthorPubkey?.trim().toLowerCase();

  for (const message of threadMessages) {
    const aliases = collectMessageIdentityAliases(message);
    let derived: ReadonlyArray<string> = [];
    if (params.deleteAuthorPubkey) {
      const sender = message.senderPubkey?.trim().toLowerCase();
      if (sender && sender === author) {
        const recipient = message.isOutgoing
          ? message.recipientPubkey
          : params.myPublicKeyHex;
        if (recipient) {
          derived = await buildDeleteTargetIdsForDm({
            message,
            senderPubkey: params.deleteAuthorPubkey,
            recipientPubkey: recipient,
          });
        }
      }
    }
    const intersectsTarget = (
      aliases.some((alias) => targetSet.has(alias))
      || derived.some((id) => targetSet.has(id))
    );
    if (!intersectsTarget) {
      continue;
    }
    for (const alias of aliases) {
      resolved.add(alias);
    }
    for (const id of derived) {
      resolved.add(id);
    }
  }

  return Array.from(resolved);
};
