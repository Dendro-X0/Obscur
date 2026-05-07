/**
 * dm-receive-pipeline.ts
 *
 * Single canonical receive path for incoming DMs.
 * event → validate → decrypt → dedup → route to callback
 *
 * Owns: decryption, dedup, sender validation.
 * Does NOT own: React state, persistence, subscription lifecycle.
 */

import { cryptoService } from "@/app/features/crypto/crypto-service";
import type { NostrEvent } from "@dweb/nostr/nostr-event";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { Message } from "@/app/features/messaging/types";
import type { BlocklistContract, PeerTrustContract } from "./dm-controller-types";
import { isMessageDeleteSuppressed } from "../../services/message-delete-tombstone-store";

// ---------------------------------------------------------------------------
// Dedup: track processed event IDs to prevent double-processing
// ---------------------------------------------------------------------------

const processedEventIds = new Set<string>();
const MAX_PROCESSED_CACHE = 2000;

const markProcessed = (eventId: string): boolean => {
  if (processedEventIds.has(eventId)) return false;
  processedEventIds.add(eventId);
  if (processedEventIds.size > MAX_PROCESSED_CACHE) {
    // Evict oldest entries
    const entries = Array.from(processedEventIds);
    entries.slice(0, MAX_PROCESSED_CACHE / 2).forEach(id => processedEventIds.delete(id));
  }
  return true;
};

// ---------------------------------------------------------------------------
// Decrypt
// ---------------------------------------------------------------------------

type DecryptResult =
  | { ok: true; plaintext: string; senderPubkey: string; eventId: string; createdAt: number; tags: ReadonlyArray<ReadonlyArray<string>> }
  | { ok: false; reason: string };

const decryptIncomingEvent = async (params: Readonly<{
  event: NostrEvent;
  myPublicKeyHex: PublicKeyHex;
  myPrivateKeyHex: PrivateKeyHex;
}>): Promise<DecryptResult> => {
  const { event, myPublicKeyHex, myPrivateKeyHex } = params;

  try {
    if (event.kind === 1059) {
      // NIP-17 gift-wrapped DM
      const rumor = await cryptoService.decryptGiftWrap(event, myPrivateKeyHex);
      if (!rumor || typeof rumor.content !== "string") {
        return { ok: false, reason: "gift_wrap_decrypt_failed" };
      }
      return {
        ok: true,
        plaintext: rumor.content,
        senderPubkey: rumor.pubkey || event.pubkey,
        eventId: rumor.id || event.id,
        createdAt: rumor.created_at || event.created_at,
        tags: rumor.tags || event.tags || [],
      };
    }

    if (event.kind === 4) {
      // NIP-04 legacy DM
      const isSelfAuthored = event.pubkey === myPublicKeyHex;
      const peerPubkey = isSelfAuthored
        ? (event.tags.find(t => t[0] === "p")?.[1] || "")
        : event.pubkey;

      if (!peerPubkey) {
        return { ok: false, reason: "no_peer_pubkey" };
      }

      const plaintext = await cryptoService.decryptDM(
        event.content,
        peerPubkey,
        myPrivateKeyHex,
      );
      return {
        ok: true,
        plaintext,
        senderPubkey: event.pubkey,
        eventId: event.id,
        createdAt: event.created_at,
        tags: event.tags || [],
      };
    }

    return { ok: false, reason: `unsupported_kind_${event.kind}` };
  } catch (err) {
    console.warn("[dm-receive] decrypt failed", {
      eventId: event.id.slice(0, 16),
      kind: event.kind,
      error: err instanceof Error ? err.message.slice(0, 80) : String(err).slice(0, 80),
    });
    return { ok: false, reason: err instanceof Error ? err.message : "decrypt_error" };
  }
};

// ---------------------------------------------------------------------------
// Parse delete commands from message content
// ---------------------------------------------------------------------------

const COMMAND_MESSAGE_PREFIX = "__dweb_cmd__";

const parseDeleteCommand = (plaintext: string, tags?: ReadonlyArray<ReadonlyArray<string>>): ReadonlyArray<string> | null => {
  // Strip the __dweb_cmd__ prefix if present (format used by use-chat-actions deleteForEveryone)
  const jsonStr = plaintext.startsWith(COMMAND_MESSAGE_PREFIX)
    ? plaintext.slice(COMMAND_MESSAGE_PREFIX.length)
    : plaintext;

  try {
    const parsed = JSON.parse(jsonStr);
    if (parsed && parsed.type === "delete" && typeof parsed.targetMessageId === "string") {
      // Also collect any "e" tag IDs (use-chat-actions sends these as additional delete targets)
      const eTagIds = tags
        ?.filter(t => t[0] === "e" && typeof t[1] === "string")
        .map(t => t[1]) ?? [];
      const allIds = new Set([parsed.targetMessageId, ...eTagIds]);
      return Array.from(allIds);
    }
    if (parsed && parsed.type === "delete" && Array.isArray(parsed.targetMessageIds)) {
      return parsed.targetMessageIds.filter((id: unknown): id is string => typeof id === "string");
    }
  } catch {
    // Not JSON — normal message
  }
  return null;
};

// ---------------------------------------------------------------------------
// Process one incoming event — the single canonical path
// ---------------------------------------------------------------------------

export type IncomingDmResult =
  | { action: "message"; message: Message }
  | { action: "self_echo"; message: Message }
  | { action: "delete"; targetMessageIds: ReadonlyArray<string>; senderPubkey: string; conversationId: string }
  | { action: "skipped"; reason: string };

export const processIncomingEvent = async (params: Readonly<{
  event: NostrEvent;
  relayUrl: string;
  ingestSource: "relay_live" | "relay_sync";
  myPublicKeyHex: PublicKeyHex;
  myPrivateKeyHex: PrivateKeyHex;
  blocklist?: BlocklistContract;
  peerTrust?: PeerTrustContract;
}>): Promise<IncomingDmResult> => {
  const { event, relayUrl, ingestSource, myPublicKeyHex, myPrivateKeyHex, blocklist } = params;

  // --- Basic validation ---
  if (!event || !event.id || !event.pubkey) {
    return { action: "skipped", reason: "invalid_event" };
  }

  // --- Dedup ---
  if (!markProcessed(event.id)) {
    return { action: "skipped", reason: "already_processed" };
  }

  // --- Decrypt ---
  const decrypted = await decryptIncomingEvent({ event, myPublicKeyHex, myPrivateKeyHex });
  if (!decrypted.ok) {
    return { action: "skipped", reason: `decrypt_failed:${decrypted.reason}` };
  }

  const { plaintext, senderPubkey, eventId, createdAt, tags } = decrypted;

  // --- Self-authored check ---
  const isSelfAuthored = senderPubkey === myPublicKeyHex;

  // --- Blocked sender ---
  if (!isSelfAuthored && blocklist?.isBlocked({ publicKeyHex: senderPubkey })) {
    return { action: "skipped", reason: "blocked_sender" };
  }

  // --- Tombstone check ---
  if (isMessageDeleteSuppressed(eventId)) {
    return { action: "skipped", reason: "tombstoned" };
  }

  // --- Delete command ---
  const deleteTargets = parseDeleteCommand(plaintext, tags);
  if (deleteTargets && deleteTargets.length > 0) {
    const conversationId = [myPublicKeyHex, senderPubkey].sort().join(":");
    console.log("[dm-receive] delete command received", {
      eventId: eventId.slice(0, 16),
      senderPubkey: senderPubkey.slice(0, 16),
      isSelfAuthored,
      targetMessageIds: deleteTargets.map(id => id.slice(0, 16)),
      conversationId: conversationId.slice(0, 32),
      tagCount: tags.length,
    });
    return {
      action: "delete",
      targetMessageIds: deleteTargets,
      senderPubkey,
      conversationId,
    };
  }

  // --- Build message ---
  const conversationId = [myPublicKeyHex, senderPubkey].sort().join(":");
  const message: Message = {
    id: eventId,
    conversationId,
    content: plaintext,
    kind: "user",
    timestamp: new Date(createdAt * 1000),
    isOutgoing: isSelfAuthored,
    status: isSelfAuthored ? "delivered" : "delivered",
    eventId,
    eventCreatedAt: new Date(createdAt * 1000),
    senderPubkey,
    recipientPubkey: isSelfAuthored
      ? (tags.find(t => t[0] === "p")?.[1] || myPublicKeyHex)
      : myPublicKeyHex,
    encryptedContent: event.content,
  };

  console.log("[dm-receive] processed", {
    eventId: eventId.slice(0, 16),
    sender: senderPubkey.slice(0, 16),
    isSelfAuthored,
    ingestSource,
    relay: relayUrl.slice(0, 40),
    contentPreview: plaintext.slice(0, 30),
  });

  if (isSelfAuthored) {
    return { action: "self_echo", message };
  }

  return { action: "message", message };
};

// ---------------------------------------------------------------------------
// Internals for testing
// ---------------------------------------------------------------------------

export const dmReceivePipelineInternals = {
  processedEventIds,
  markProcessed,
  decryptIncomingEvent,
  parseDeleteCommand,
};
