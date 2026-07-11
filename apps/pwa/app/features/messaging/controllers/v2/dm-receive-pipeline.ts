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
import { logAppEvent } from "@/app/shared/log-app-event";
import type { NostrEvent } from "@dweb/nostr/nostr-event";
import type { Message } from "../../types";
import { parseCommandMessage } from "../../utils/commands";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { BlocklistContract, PeerTrustContract, RequestsInboxContract } from "./dm-controller-types";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { messagingClientOperations } from "../../services/messaging-client-operations";
import { toDmConversationIdFromEvent } from "../../utils/dm-conversation-id";
import { decodeDmDeleteCommandV1 } from "../../deletion/delete-command-codec";
import {
  resolveContactRequestReceiveRoute,
  resolvePeerPublicKeyHexForIncomingEvent,
  resolveRequestEventIdFromTags,
  shouldAcceptSandboxQna,
  shouldBlockUntaggedStrangerDm,
  type ConnectionReceiveLifecycleTag,
} from "../../services/contact-request-receive-classifier";

// ---------------------------------------------------------------------------
// Dedup: track processed event IDs to prevent double-processing
// ---------------------------------------------------------------------------

// NOTE: Do NOT use a module-level singleton set here. In single-process
// multi-profile environments (e.g. A/B dev testing), both controllers
// share the same module scope. A module-level set would cause Controller B
// to mark an event as "processed" before Controller A sees it, silently
// dropping B→A messages. Instead, callers pass their own per-instance set.

export const createDedupSet = (): Set<string> => new Set<string>();

const MAX_PROCESSED_CACHE = 2000;

const markProcessed = (dedupSet: Set<string>, eventId: string): boolean => {
  if (dedupSet.has(eventId)) {
    console.log("[dm-receive-pipeline] Dedup skipped", { eventId: eventId.slice(0, 16) });
    return false;
  }
  dedupSet.add(eventId);
  if (dedupSet.size > MAX_PROCESSED_CACHE) {
    // Evict oldest entries
    const entries = Array.from(dedupSet);
    entries.slice(0, MAX_PROCESSED_CACHE / 2).forEach(id => dedupSet.delete(id));
  }
  console.log("[dm-receive-pipeline] Marked as processed", { eventId: eventId.slice(0, 16) });
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

  console.log("[dm-receive] Decrypting event", {
    eventId: event.id.slice(0, 16),
    kind: event.kind,
    pubkey: event.pubkey.slice(0, 16),
    tags: event.tags,
    contentLength: event.content.length,
  });

  try {
    if (event.kind === 1059) {
      // NIP-17 gift-wrapped DM
      const rumor = await cryptoService.decryptGiftWrap(event, myPrivateKeyHex);
      if (!rumor || typeof rumor.content !== "string") {
        console.log("[dm-receive] Gift wrap decrypt failed", { eventId: event.id.slice(0, 16) });
        return { ok: false, reason: "gift_wrap_decrypt_failed" };
      }
      console.log("[dm-receive] Gift wrap decrypted", {
        eventId: event.id.slice(0, 16),
        plaintext: rumor.content.slice(0, 100),
      });
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
        console.log("[dm-receive] No peer pubkey", { eventId: event.id.slice(0, 16) });
        return { ok: false, reason: "no_peer_pubkey" };
      }

      const plaintext = await cryptoService.decryptDM(
        event.content,
        peerPubkey,
        myPrivateKeyHex,
      );
      console.log("[dm-receive] NIP-04 decrypted", {
        eventId: event.id.slice(0, 16),
        plaintext: plaintext.slice(0, 100),
        isSelfAuthored,
      });
      return {
        ok: true,
        plaintext,
        senderPubkey: event.pubkey,
        eventId: event.id,
        createdAt: event.created_at,
        tags: event.tags || [],
      };
    }

    console.log("[dm-receive] Unsupported kind", { kind: event.kind });
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
const DELETE_COMMAND_PREFIX = "__dweb_cmd__delete:";

const parseDeleteCommand = (plaintext: string, tags?: ReadonlyArray<ReadonlyArray<string>>): ReadonlyArray<string> | null => {
  const trimmed = plaintext.trimStart();
  const eTagIdsFromTags = tags
    ?.filter((t) => t[0] === "e" && typeof t[1] === "string")
    .map((t) => t[1].trim())
    .filter((id) => id.length > 0) ?? [];

  // Versioned delete-for-everyone: single source of truth with coordinator `processIncomingDmDeleteCommand`
  if (trimmed.startsWith(DELETE_COMMAND_PREFIX)) {
    const decoded = decodeDmDeleteCommandV1(trimmed);
    const merged = new Set<string>();
    if (decoded) {
      for (const id of decoded.targetMessageIdentityIds) {
        const t = id.trim();
        if (t.length > 0) {
          merged.add(t);
        }
      }
    } else {
      // Lenient fallback if codec tight validation lags a minor field
      try {
        const parsed = JSON.parse(trimmed.slice(DELETE_COMMAND_PREFIX.length)) as {
          type?: unknown;
          targetMessageIdentityIds?: unknown;
        };
        if (parsed?.type === "message_delete_v1" && Array.isArray(parsed.targetMessageIdentityIds)) {
          for (const id of parsed.targetMessageIdentityIds) {
            if (typeof id === "string") {
              const idTrimmed = id.trim();
              if (idTrimmed.length > 0) {
                merged.add(idTrimmed);
              }
            }
          }
        }
      } catch {
        // ignore
      }
    }
    for (const id of eTagIdsFromTags) {
      merged.add(id);
    }
    if (merged.size > 0) {
      return Array.from(merged);
    }
    return null;
  }

  // Legacy: Strip the __dweb_cmd__ prefix if present (format used by legacy deleteForEveryone)
  const jsonStr = trimmed.startsWith(COMMAND_MESSAGE_PREFIX)
    ? trimmed.slice(COMMAND_MESSAGE_PREFIX.length)
    : trimmed;

  try {
    const parsed = JSON.parse(jsonStr);
    if (parsed && parsed.type === "delete" && typeof parsed.targetMessageId === "string") {
      // Also collect any "e" tag IDs (legacy sends these as additional delete targets)
      const allIds = new Set<string>([parsed.targetMessageId, ...eTagIdsFromTags]);
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
  | { action: "contact_sandbox"; lifecycleTag: "connection-request" | "connection-qna"; message: Message; isSelfAuthored: boolean }
  | { action: "contact_lifecycle"; lifecycleTag: Extract<ConnectionReceiveLifecycleTag, "connection-accept" | "connection-decline" | "connection-cancel">; peerPublicKeyHex: string; requestEventId?: string; isSelfAuthored: boolean }
  | { action: "contact_wire_evidence"; lifecycleTag: Extract<ConnectionReceiveLifecycleTag, "connection-received" | "connection-receipt">; peerPublicKeyHex: string; requestEventId?: string }
  | { action: "delete"; targetMessageIds: ReadonlyArray<string>; senderPubkey: string; conversationId: string; plaintext: string }
  | { action: "skipped"; reason: string };

export const processIncomingEvent = async (params: Readonly<{
  event: NostrEvent;
  myPublicKeyHex: PublicKeyHex;
  myPrivateKeyHex: PrivateKeyHex;
  blocklist?: BlocklistContract;
  peerTrust?: PeerTrustContract;
  requestsInbox?: RequestsInboxContract;
  dedupSet: Set<string>;
}>): Promise<IncomingDmResult> => {
  const { event, myPublicKeyHex, myPrivateKeyHex, blocklist, peerTrust, requestsInbox, dedupSet } = params;

  console.log("[dm-receive] Processing incoming event", {
    eventId: event.id.slice(0, 16),
    kind: event.kind,
    pubkey: event.pubkey.slice(0, 16),
  });

  // NOTE: Dedup gate is intentionally placed AFTER decryption and delete
  // command detection. Delete commands must always bypass dedup so that
  // the separate delete subscription (or a re-delivery from the relay)
  // can apply the deletion even if the event was already seen as a message.
  // This mirrors the v1.3.15 incoming-dm-event-handler.ts behavior.

  // Decrypt
  const decryptResult = await decryptIncomingEvent({
    event,
    myPublicKeyHex,
    myPrivateKeyHex,
  });

  if (!decryptResult.ok) {
    console.log("[dm-receive] Decrypt failed", {
      eventId: event.id.slice(0, 16),
      reason: decryptResult.reason,
    });
    return { action: "skipped", reason: decryptResult.reason };
  }

  const { plaintext, senderPubkey, eventId, createdAt, tags } = decryptResult;

  console.log("[dm-receive] Decrypted successfully", {
    eventId: eventId.slice(0, 16),
    plaintext: plaintext.slice(0, 100),
    senderPubkey: senderPubkey.slice(0, 16),
  });

  // Blocklist check
  if (blocklist?.isBlocked({ publicKeyHex: senderPubkey })) {
    console.log("[dm-receive] Blocked", { senderPubkey: senderPubkey.slice(0, 16) });
    return { action: "skipped", reason: "blocked" };
  }

  // --- Self-authored check ---
  const isSelfAuthored = senderPubkey === myPublicKeyHex;
  const parsedCommandKind = parseCommandMessage(plaintext);

  // Classify as delete BEFORE dedup so delete commands always get applied.
  // Check delete command early — before marking as processed.
  const earlyDeleteTargets = parseDeleteCommand(plaintext, tags);
  if (earlyDeleteTargets && earlyDeleteTargets.length > 0) {
    const conversationId = toDmConversationIdFromEvent({
      myPublicKeyHex,
      senderPubkey,
      tags,
    }) ?? [myPublicKeyHex, senderPubkey].sort().join(":");
    console.log("[dm-receive] delete command (dedup-bypass)", {
      eventId: eventId.slice(0, 16),
      senderPubkey: senderPubkey.slice(0, 16),
      isSelfAuthored,
      targetMessageIds: earlyDeleteTargets.map(id => id.slice(0, 16)),
    });
    // Mark processed NOW so duplicate relay deliveries are skipped,
    // but we already have the delete result to return.
    markProcessed(dedupSet, event.id);
    return {
      action: "delete",
      targetMessageIds: earlyDeleteTargets,
      senderPubkey,
      conversationId,
      plaintext,
    };
  }

  // Dedup: skip non-delete events we've already processed
  if (!markProcessed(dedupSet, event.id)) {
    console.log("[dm-receive] Skipped (dedup)", { eventId: event.id.slice(0, 16) });
    return { action: "skipped", reason: "dedup" };
  }
  logAppEvent({
    name: "messaging.delete_for_everyone_remote_result",
    level: "debug",
    scope: { feature: "messaging", action: "delete_for_everyone" },
    context: {
      channel: "dm_receive_plaintext_classified",
      resultCode: plaintext.startsWith(DELETE_COMMAND_PREFIX)
        ? "delete_prefix"
        : parsedCommandKind?.type === "delete"
          ? "legacy_command_delete"
          : parsedCommandKind
            ? `legacy_command:${parsedCommandKind.type}`
            : "normal_plaintext",
      reasonCode: null,
      deliveryStatus: "received",
      conversationIdHint: [myPublicKeyHex, senderPubkey].sort().join(":").slice(0, 32),
      messageIdHint: eventId.slice(0, 16),
      conversationKind: "dm",
      isOutgoing: isSelfAuthored,
      deleteTargetCount: 0,
      remoteMessageIdHint: event.id.slice(0, 16),
    },
  });

  // --- Tombstone check ---
  const profileId = getResolvedProfileId();
  if (messagingClientOperations.isDmMessageSuppressed(eventId, profileId ?? undefined)) {
    console.log("[dm-receive] Tombstoned", { eventId: eventId.slice(0, 16), profileId: profileId?.slice(0, 16) });
    return { action: "skipped", reason: "tombstoned" };
  }

  const receiveRoute = resolveContactRequestReceiveRoute({ tags });
  const peerPublicKeyHex = resolvePeerPublicKeyHexForIncomingEvent({
    isSelfAuthored,
    senderPubkey,
    tags,
  });
  const requestStatus = peerPublicKeyHex
    ? requestsInbox?.getRequestStatus({ peerPublicKeyHex })
    : null;
  const isPeerAcceptedByTrust = peerPublicKeyHex
    ? (peerTrust?.isAccepted({ publicKeyHex: peerPublicKeyHex }) ?? false)
    : false;

  if (receiveRoute.kind === "lifecycle" && peerPublicKeyHex) {
    console.log("[dm-receive] contact lifecycle", {
      eventId: eventId.slice(0, 16),
      lifecycleTag: receiveRoute.lifecycleTag,
      peerPublicKeyHex: peerPublicKeyHex.slice(0, 16),
      isSelfAuthored,
    });
    return {
      action: "contact_lifecycle",
      lifecycleTag: receiveRoute.lifecycleTag,
      peerPublicKeyHex,
      requestEventId: resolveRequestEventIdFromTags(tags),
      isSelfAuthored,
    };
  }

  if (receiveRoute.kind === "wire_evidence" && peerPublicKeyHex) {
    console.log("[dm-receive] contact wire evidence", {
      eventId: eventId.slice(0, 16),
      lifecycleTag: receiveRoute.lifecycleTag,
      peerPublicKeyHex: peerPublicKeyHex.slice(0, 16),
    });
    return {
      action: "contact_wire_evidence",
      lifecycleTag: receiveRoute.lifecycleTag,
      peerPublicKeyHex,
      requestEventId: resolveRequestEventIdFromTags(tags),
    };
  }

  if (receiveRoute.kind === "sandbox_message") {
    if (
      receiveRoute.lifecycleTag === "connection-qna"
      && !shouldAcceptSandboxQna({
        lifecycleTag: "connection-qna",
        isSelfAuthored,
        requestStatus,
      })
    ) {
      console.log("[dm-receive] sandbox Q&A rejected — handshake not pending", {
        eventId: eventId.slice(0, 16),
        peerPublicKeyHex: peerPublicKeyHex?.slice(0, 16),
      });
      return { action: "skipped", reason: "contact_qna_not_pending" };
    }
  } else if (shouldBlockUntaggedStrangerDm({
    isSelfAuthored,
    isPeerAcceptedByTrust,
    requestStatus,
  })) {
    console.log("[dm-receive] blocked untagged stranger DM", {
      eventId: eventId.slice(0, 16),
      peerPublicKeyHex: peerPublicKeyHex?.slice(0, 16),
    });
    return { action: "skipped", reason: "stranger_dm_blocked" };
  }

  // --- Build message ---
  const conversationId = toDmConversationIdFromEvent({
    myPublicKeyHex,
    senderPubkey,
    tags,
  }) ?? [myPublicKeyHex, senderPubkey].sort().join(":");
  const message: Message = {
    id: eventId,
    conversationId,
    content: plaintext,
    kind: "user",
    timestamp: new Date(createdAt * 1000),
    isOutgoing: isSelfAuthored,
    status: isSelfAuthored ? "delivered" : "delivered",
    eventId,
    ...(event.kind === 1059 ? { relayPublishedEventId: event.id } : {}),
    eventCreatedAt: new Date(createdAt * 1000),
    senderPubkey,
    recipientPubkey: isSelfAuthored
      ? (tags.find(t => t[0] === "p")?.[1] || myPublicKeyHex)
      : myPublicKeyHex,
    encryptedContent: event.content,
  };

  console.log("[dm-receive] processed message", {
    eventId: eventId.slice(0, 16),
    sender: senderPubkey.slice(0, 16),
    isSelfAuthored,
    contentPreview: plaintext.slice(0, 30),
    receiveRoute: receiveRoute.kind,
  });

  if (receiveRoute.kind === "sandbox_message") {
    return {
      action: "contact_sandbox",
      lifecycleTag: receiveRoute.lifecycleTag,
      message,
      isSelfAuthored,
    };
  }

  if (isSelfAuthored) {
    return { action: "self_echo", message };
  }

  return { action: "message", message };
};

// ---------------------------------------------------------------------------
// Dedicated delete-only processor — bypasses dedup
// ---------------------------------------------------------------------------

export type DeleteOnlyResult =
  | { action: "delete"; targetMessageIds: ReadonlyArray<string>; senderPubkey: string; conversationId: string; plaintext: string }
  | { action: "skipped"; reason: string };

/**
 * processDeleteEventDirect
 *
 * Decrypts and classifies an incoming event as a delete command WITHOUT
 * consulting the shared dedup set. Called exclusively by the delete
 * subscription so that delete commands are always applied even if the
 * event was already processed as a normal message by the main subscription.
 */
export const processDeleteEventDirect = async (params: Readonly<{
  event: NostrEvent;
  myPublicKeyHex: PublicKeyHex;
  myPrivateKeyHex: PrivateKeyHex;
}>): Promise<DeleteOnlyResult> => {
  const { event, myPublicKeyHex, myPrivateKeyHex } = params;

  const decryptResult = await decryptIncomingEvent({ event, myPublicKeyHex, myPrivateKeyHex });
  if (!decryptResult.ok) {
    console.log("[dm-receive-delete] Decrypt failed", { eventId: event.id.slice(0, 16), reason: decryptResult.reason });
    return { action: "skipped", reason: decryptResult.reason };
  }

  const { plaintext, senderPubkey, tags } = decryptResult;

  const deleteTargets = parseDeleteCommand(plaintext, tags);
  if (!deleteTargets || deleteTargets.length === 0) {
    console.log("[dm-receive-delete] Not a delete command", { eventId: event.id.slice(0, 16), plaintextPrefix: plaintext.slice(0, 40) });
    return { action: "skipped", reason: "not_delete_command" };
  }

  const conversationId = toDmConversationIdFromEvent({
    myPublicKeyHex,
    senderPubkey,
    tags,
  }) ?? [myPublicKeyHex, senderPubkey].sort().join(":");
  console.log("[dm-receive-delete] Delete command confirmed (dedup-bypass)", {
    eventId: event.id.slice(0, 16),
    senderPubkey: senderPubkey.slice(0, 16),
    targetMessageIds: deleteTargets.map(id => id.slice(0, 16)),
    conversationId: conversationId.slice(0, 32),
  });
  return { action: "delete", targetMessageIds: deleteTargets, senderPubkey, conversationId, plaintext };
};

// ---------------------------------------------------------------------------
// Internals for testing
// ---------------------------------------------------------------------------

export const dmReceivePipelineInternals = {
  markProcessed,
  decryptIncomingEvent,
  parseDeleteCommand,
};
