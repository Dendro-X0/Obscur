/**
 * Delete Command Codec
 *
 * Versioned encoding/decoding for delete commands.
 *
 * Rules:
 * - All delete commands are versioned (v1+)
 * - Commands include sufficient metadata for verification
 * - Community and DM commands use different but similar structures
 */

import type {
  DmDeleteCommandV1,
  CommunityDeleteCommandV1,
  DeleteCommandV1,
  PublicKeyHex,
} from "./types";

const COMMAND_PREFIX = "__dweb_cmd__delete:";
const CURRENT_VERSION = 1;

const createDeleteCommandNonce = (): string => (
  typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : `delete-nonce-${Date.now()}-${Math.random().toString(16).slice(2)}`
);

// ---------------------------------------------------------------------------
// DM Delete Commands
// ---------------------------------------------------------------------------

/**
 * Encode a DM delete command for network transmission.
 */
export function encodeDmDeleteCommandV1(
  params: {
    conversationId: string;
    targetMessageIdentityIds: string[];
    targetAuthorPubkey: PublicKeyHex;
    deletedByPubkey: PublicKeyHex;
  }
): string {
  const command: DmDeleteCommandV1 = {
    type: "message_delete_v1",
    mode: "delete_for_everyone",
    conversationId: params.conversationId,
    targetMessageIdentityIds: params.targetMessageIdentityIds,
    targetAuthorPubkey: params.targetAuthorPubkey,
    deletedByPubkey: params.deletedByPubkey,
    deletedAt: Date.now(),
    nonce: createDeleteCommandNonce(),
  };

  return `${COMMAND_PREFIX}${JSON.stringify(command)}`;
}

/**
 * Decode a DM delete command from network payload.
 * Returns null if invalid or wrong version.
 */
export function decodeDmDeleteCommandV1(
  plaintext: string
): DmDeleteCommandV1 | null {
  const trimmed = plaintext.trimStart();
  if (!trimmed.startsWith(COMMAND_PREFIX)) {
    return null;
  }

  try {
    const json = trimmed.slice(COMMAND_PREFIX.length);
    const parsed = JSON.parse(json) as unknown;

    // Validate structure
    if (!isValidDmDeleteCommandV1(parsed)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

/**
 * Same contract as receive pipeline: strict decode first, then lenient field recovery.
 */
export function decodeDmDeleteCommandLenient(
  plaintext: string,
): DmDeleteCommandV1 | null {
  const strict = decodeDmDeleteCommandV1(plaintext);
  if (strict) {
    return strict;
  }

  const trimmed = plaintext.trimStart();
  if (!trimmed.startsWith(COMMAND_PREFIX)) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed.slice(COMMAND_PREFIX.length)) as Partial<DmDeleteCommandV1>;
    if (
      parsed?.type !== "message_delete_v1"
      || parsed.mode !== "delete_for_everyone"
      || typeof parsed.conversationId !== "string"
      || !Array.isArray(parsed.targetMessageIdentityIds)
      || typeof parsed.targetAuthorPubkey !== "string"
      || typeof parsed.deletedByPubkey !== "string"
    ) {
      return null;
    }

    const targetMessageIdentityIds = parsed.targetMessageIdentityIds
      .filter((id): id is string => typeof id === "string" && id.trim().length > 0)
      .map((id) => id.trim());
    if (targetMessageIdentityIds.length === 0) {
      return null;
    }

    return {
      type: "message_delete_v1",
      mode: "delete_for_everyone",
      conversationId: parsed.conversationId,
      targetMessageIdentityIds,
      targetAuthorPubkey: parsed.targetAuthorPubkey as PublicKeyHex,
      deletedByPubkey: parsed.deletedByPubkey as PublicKeyHex,
      deletedAt: typeof parsed.deletedAt === "number" ? parsed.deletedAt : Date.now(),
      nonce: typeof parsed.nonce === "string" && parsed.nonce.trim().length > 0
        ? parsed.nonce.trim()
        : createDeleteCommandNonce(),
    };
  } catch {
    return null;
  }
}

function isValidDmDeleteCommandV1(obj: unknown): obj is DmDeleteCommandV1 {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const cmd = obj as Partial<DmDeleteCommandV1>;

  return (
    cmd.type === "message_delete_v1" &&
    cmd.mode === "delete_for_everyone" &&
    typeof cmd.conversationId === "string" &&
    Array.isArray(cmd.targetMessageIdentityIds) &&
    cmd.targetMessageIdentityIds.every((id) => typeof id === "string") &&
    typeof cmd.targetAuthorPubkey === "string" &&
    typeof cmd.deletedByPubkey === "string" &&
    typeof cmd.deletedAt === "number" &&
    typeof cmd.nonce === "string"
  );
}

// ---------------------------------------------------------------------------
// Community Delete Commands
// ---------------------------------------------------------------------------

/**
 * Encode a community delete command for network transmission.
 */
export function encodeCommunityDeleteCommandV1(
  params: {
    groupId: string;
    relayUrl: string;
    conversationId: string;
    targetMessageIdentityIds: string[];
    targetAuthorPubkey: PublicKeyHex;
    deletedByPubkey: PublicKeyHex;
  }
): string {
  const command: CommunityDeleteCommandV1 = {
    type: "community_message_delete_v1",
    mode: "delete_for_everyone",
    groupId: params.groupId,
    relayUrl: params.relayUrl,
    conversationId: params.conversationId,
    targetMessageIdentityIds: params.targetMessageIdentityIds,
    targetAuthorPubkey: params.targetAuthorPubkey,
    deletedByPubkey: params.deletedByPubkey,
    deletedAt: Date.now(),
    nonce: createDeleteCommandNonce(),
  };

  return `${COMMAND_PREFIX}${JSON.stringify(command)}`;
}

/**
 * Decode a community delete command from network payload.
 */
export function decodeCommunityDeleteCommandV1(
  plaintext: string
): CommunityDeleteCommandV1 | null {
  if (!plaintext.startsWith(COMMAND_PREFIX)) {
    return null;
  }

  try {
    const json = plaintext.slice(COMMAND_PREFIX.length);
    const parsed = JSON.parse(json) as unknown;

    if (!isValidCommunityDeleteCommandV1(parsed)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function isValidCommunityDeleteCommandV1(
  obj: unknown
): obj is CommunityDeleteCommandV1 {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const cmd = obj as Partial<CommunityDeleteCommandV1>;

  return (
    cmd.type === "community_message_delete_v1" &&
    cmd.mode === "delete_for_everyone" &&
    typeof cmd.groupId === "string" &&
    typeof cmd.relayUrl === "string" &&
    typeof cmd.conversationId === "string" &&
    Array.isArray(cmd.targetMessageIdentityIds) &&
    cmd.targetMessageIdentityIds.every((id) => typeof id === "string") &&
    typeof cmd.targetAuthorPubkey === "string" &&
    typeof cmd.deletedByPubkey === "string" &&
    typeof cmd.deletedAt === "number" &&
    typeof cmd.nonce === "string"
  );
}

// ---------------------------------------------------------------------------
// Generic Decoding
// ---------------------------------------------------------------------------

/**
 * Attempt to decode any delete command version.
 * Returns null if not a delete command or invalid.
 */
export function decodeDeleteCommand(
  plaintext: string
): DeleteCommandV1 | null {
  // Try DM version first
  const dmCmd = decodeDmDeleteCommandV1(plaintext);
  if (dmCmd) {
    return dmCmd;
  }

  // Try community version
  const communityCmd = decodeCommunityDeleteCommandV1(plaintext);
  if (communityCmd) {
    return communityCmd;
  }

  return null;
}

/**
 * Check if plaintext is a delete command (any version).
 * Useful for message routing.
 */
export function isDeleteCommand(plaintext: string): boolean {
  return plaintext.startsWith(COMMAND_PREFIX);
}

// ---------------------------------------------------------------------------
// Command Metadata Extraction
// ---------------------------------------------------------------------------

/**
 * Extract target message IDs from a delete command without full decoding.
 * Returns empty array if not a valid command.
 */
export function extractDeleteCommandTargetIds(
  plaintext: string
): string[] {
  const cmd = decodeDeleteCommand(plaintext);
  if (!cmd) {
    return [];
  }
  return cmd.targetMessageIdentityIds;
}

/**
 * Extract sender pubkey from a delete command.
 * This is the pubkey that claims to have sent the delete.
 */
export function extractDeleteCommandSender(
  plaintext: string
): PublicKeyHex | null {
  const cmd = decodeDeleteCommand(plaintext);
  if (!cmd) {
    return null;
  }
  return cmd.deletedByPubkey;
}

/**
 * Extract conversation ID from a delete command.
 */
export function extractDeleteCommandConversationId(
  plaintext: string
): string | null {
  const cmd = decodeDeleteCommand(plaintext);
  if (!cmd) {
    return null;
  }
  return cmd.conversationId;
}
