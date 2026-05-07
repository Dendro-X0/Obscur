/**
 * dm-delete-pipeline.ts
 *
 * Single canonical path for message deletion.
 * Builds a delete-command DM, publishes it, and tombstones locally.
 *
 * Owns: delete command construction, tombstone creation, relay publish.
 * Does NOT own: React state, IndexedDB operations.
 */

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { RelayPoolContract, DeleteResult } from "./dm-controller-types";
import { sendDm } from "./dm-send-pipeline";
import { suppressMessageDeleteTombstone } from "../../services/message-delete-tombstone-store";
import { createDeleteCommandMessage, encodeCommandMessage } from "../../utils/commands";

// ---------------------------------------------------------------------------
// Delete via DM command
// ---------------------------------------------------------------------------

export const deleteMessages = async (params: Readonly<{
  pool: RelayPoolContract;
  senderPublicKeyHex: PublicKeyHex;
  senderPrivateKeyHex: PrivateKeyHex;
  peerPublicKeyHex: PublicKeyHex;
  targetMessageIds: ReadonlyArray<string>;
  conversationId: string;
}>): Promise<DeleteResult> => {
  const { targetMessageIds, senderPublicKeyHex, senderPrivateKeyHex, peerPublicKeyHex, pool } = params;

  if (targetMessageIds.length === 0) {
    return { success: false, deletedMessageIds: [], error: "No message IDs to delete" };
  }

  // Tombstone locally first — prevents re-processing from relay sync
  const nowMs = Date.now();
  targetMessageIds.forEach(id => suppressMessageDeleteTombstone(id, nowMs));

  // Build delete command payload — use the canonical __dweb_cmd__ prefix
  // so the sender's controller marks it as kind:"command" and the receiver's
  // parseDeleteCommand can recognise it in both formats.
  const primaryTargetId = targetMessageIds[0];
  const deletePayload = encodeCommandMessage(createDeleteCommandMessage(primaryTargetId));

  // Send as a DM to the peer (the peer's receive pipeline will process the delete command)
  const result = await sendDm({
    pool,
    senderPublicKeyHex,
    senderPrivateKeyHex,
    recipientPublicKeyHex: peerPublicKeyHex,
    plaintext: deletePayload,
    customTags: [
      ["t", "message-delete"],
      ...targetMessageIds.map(id => ["e", id]),
    ],
  });

  if (result.success) {
    console.log("[dm-delete] published delete command", {
      targetIds: targetMessageIds.map(id => id.slice(0, 16)),
      eventId: result.eventId.slice(0, 16),
    });
  } else {
    console.warn("[dm-delete] delete command publish failed", {
      error: result.error,
      targetIds: targetMessageIds.map(id => id.slice(0, 16)),
    });
  }

  return {
    success: result.success,
    deletedMessageIds: result.success ? [...targetMessageIds] : [],
    error: result.error,
  };
};
