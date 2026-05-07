/**
 * dm-send-pipeline.ts
 *
 * Single canonical send path for DMs.
 * One user action → one function call → one relay publish → one status transition.
 *
 * Owns: event building, encryption, relay publish, status determination.
 * Does NOT own: React state, persistence, UI rendering.
 */

import { cryptoService, type UnsignedNostrEvent } from "@/app/features/crypto/crypto-service";
import type { NostrEvent } from "@dweb/nostr/nostr-event";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type {
  DmFormat,
  RelayPoolContract,
  RelayPublishOutcome,
  SendResult,
} from "./dm-controller-types";
import { publishToRelays, resolveTargetRelayUrls } from "./dm-relay-transport";
import { dmReceivePipelineInternals } from "./dm-receive-pipeline";

// ---------------------------------------------------------------------------
// Dedup guard — prevents double-send from React strict mode or re-renders
// ---------------------------------------------------------------------------

// Time-windowed dedup: blocks rapid double-fires from React strict mode
// but allows legitimate re-sends of the same text after a short window.
const DEDUP_WINDOW_MS = 500;
const inflight = new Map<string, number>();

const sendDedupKey = (senderPubkey: string, peerPubkey: string, plaintext: string): string =>
  `${senderPubkey}:${peerPubkey}:${plaintext.slice(0, 64)}`;

// ---------------------------------------------------------------------------
// Event ID derivation
// ---------------------------------------------------------------------------

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");

const deriveEventId = async (event: Readonly<{
  pubkey: string;
  created_at: number;
  kind: number;
  tags: ReadonlyArray<ReadonlyArray<string>>;
  content: string;
}>): Promise<string> => {
  const payload = JSON.stringify([0, event.pubkey, event.created_at, event.kind, event.tags, event.content]);
  try {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
    return toHex(new Uint8Array(digest));
  } catch {
    // FNV-1a fallback
    let hash = 0x811c9dc5;
    for (let i = 0; i < payload.length; i++) {
      hash ^= payload.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, "0").repeat(8);
  }
};

// ---------------------------------------------------------------------------
// Build encrypted event
// ---------------------------------------------------------------------------

export type BuildResult = Readonly<{
  format: DmFormat;
  signedEvent: NostrEvent;
  canonicalEventId: string;
  encryptedContent: string;
}>;

const buildDmEvent = async (params: Readonly<{
  format: DmFormat;
  plaintext: string;
  recipientPubkey: PublicKeyHex;
  senderPubkey: PublicKeyHex;
  senderPrivateKeyHex: PrivateKeyHex;
  tags: ReadonlyArray<ReadonlyArray<string>>;
}>): Promise<BuildResult> => {
  const createdAt = Math.floor(Date.now() / 1000);

  if (params.format === "nip17") {
    const rumor: UnsignedNostrEvent = {
      kind: 14,
      created_at: createdAt,
      tags: params.tags.map(t => [...t]),
      content: params.plaintext,
      pubkey: params.senderPubkey,
    };
    const canonicalEventId = await deriveEventId(rumor);
    const signedEvent = await cryptoService.encryptGiftWrap(
      rumor,
      params.senderPrivateKeyHex,
      params.recipientPubkey,
    );
    return { format: "nip17", signedEvent, canonicalEventId, encryptedContent: signedEvent.content };
  }

  // NIP-04
  const encryptedContent = await cryptoService.encryptDM(
    params.plaintext,
    params.recipientPubkey,
    params.senderPrivateKeyHex,
  );
  const unsigned: UnsignedNostrEvent = {
    kind: 4,
    created_at: createdAt,
    tags: params.tags.map(t => [...t]),
    content: encryptedContent,
    pubkey: params.senderPubkey,
  };
  const signedEvent = await cryptoService.signEvent(unsigned, params.senderPrivateKeyHex);
  return { format: "nip04", signedEvent, canonicalEventId: signedEvent.id, encryptedContent };
};

// ---------------------------------------------------------------------------
// Send pipeline — the single canonical path
// ---------------------------------------------------------------------------

export type SendConfirmation = Readonly<{
  success: boolean;
  deliveryStatus: SendResult["deliveryStatus"];
  relayResults: ReadonlyArray<RelayPublishOutcome>;
  error?: string;
}>;

export const sendDm = async (params: Readonly<{
  pool: RelayPoolContract;
  senderPublicKeyHex: PublicKeyHex;
  senderPrivateKeyHex: PrivateKeyHex;
  recipientPublicKeyHex: PublicKeyHex;
  plaintext: string;
  customTags?: ReadonlyArray<ReadonlyArray<string>>;
  preferredFormat?: DmFormat;
  onConfirmed?: (confirmation: SendConfirmation) => void;
}>): Promise<SendResult> => {
  const {
    pool,
    senderPublicKeyHex,
    senderPrivateKeyHex,
    recipientPublicKeyHex,
    plaintext,
    customTags,
    preferredFormat = "nip04",
    onConfirmed,
  } = params;

  // --- Dedup guard (time-windowed) ---
  const dedupKey = sendDedupKey(senderPublicKeyHex, recipientPublicKeyHex, plaintext);
  const lastSentAt = inflight.get(dedupKey);
  if (lastSentAt !== undefined && (Date.now() - lastSentAt) < DEDUP_WINDOW_MS) {
    console.warn("[dm-send] dedup: suppressed duplicate send", dedupKey.slice(0, 32));
    return {
      success: false,
      deliveryStatus: "failed",
      messageId: "",
      eventId: "",
      relayResults: [],
      error: "Duplicate send suppressed",
    };
  }
  inflight.set(dedupKey, Date.now());

  try {
    // --- Build tags ---
    const baseTags: string[][] = [["p", recipientPublicKeyHex]];
    if (customTags) {
      customTags.forEach(tag => baseTags.push([...tag]));
    }

    // --- Build & encrypt ---
    const build = await buildDmEvent({
      format: preferredFormat,
      plaintext,
      recipientPubkey: recipientPublicKeyHex,
      senderPubkey: senderPublicKeyHex,
      senderPrivateKeyHex,
      tags: baseTags,
    });

    // --- Pre-register in receive dedup to suppress self-echo from relay ---
    dmReceivePipelineInternals.markProcessed(build.signedEvent.id);

    // --- Phase 1: Fire immediately via sendToOpen for instant delivery ---
    const eventPayload = JSON.stringify(["EVENT", build.signedEvent]);
    let firedToOpenCount = 0;
    try {
      pool.sendToOpen(eventPayload);
      firedToOpenCount = pool.connections.filter(c => c.status === "open").length;
    } catch {
      // sendToOpen is best-effort; publishToRelays below handles confirmation
    }

    // --- Phase 2: Background relay confirmation ---
    // Resolve relay targets for confirmed publish
    const targetRelayUrls = resolveTargetRelayUrls({
      pool,
      peerPublicKeyHex: recipientPublicKeyHex,
    });

    // Fire background confirmation — do NOT block on it (when onConfirmed is set)
    let capturedConfirmation: SendConfirmation | null = null;

    const confirmationPromise = publishToRelays({
      pool,
      signedEvent: build.signedEvent,
      targetRelayUrls,
    }).then(publishResult => {
      console.log("[dm-send] confirmed", {
        eventId: build.canonicalEventId.slice(0, 16),
        format: build.format,
        success: publishResult.success,
        successCount: publishResult.successCount,
        totalRelays: publishResult.totalRelays,
      });
      // If sendToOpen already fired to open relays, never downgrade to "failed".
      // The event is already on the wire — confirmation just upgrades status.
      const effectiveSuccess = publishResult.success || firedToOpenCount > 0;
      const deliveryStatus = publishResult.success
        ? (publishResult.successCount >= 2 ? "sent_quorum" as const : "sent_partial" as const)
        : (firedToOpenCount > 0 ? "sent_partial" as const : "failed" as const);
      const confirmation: SendConfirmation = {
        success: effectiveSuccess,
        deliveryStatus,
        relayResults: publishResult.outcomes,
        error: effectiveSuccess ? undefined : publishResult.overallError,
      };
      capturedConfirmation = confirmation;
      onConfirmed?.(confirmation);
    }).catch(err => {
      console.error("[dm-send] confirmation error", err);
      // If sendToOpen succeeded, treat as delivered despite confirmation error
      const effectiveSuccess = firedToOpenCount > 0;
      const confirmation: SendConfirmation = {
        success: effectiveSuccess,
        deliveryStatus: effectiveSuccess ? "sent_partial" : "failed",
        relayResults: [],
        error: effectiveSuccess ? undefined : (err instanceof Error ? err.message : String(err)),
      };
      capturedConfirmation = confirmation;
      onConfirmed?.(confirmation);
    }).finally(() => {
      inflight.delete(dedupKey);
    });

    // If no callback, await for backward compat (connection request, delete commands)
    if (!onConfirmed) {
      await confirmationPromise;
      const conf = capturedConfirmation!;
      return {
        success: conf.success,
        deliveryStatus: conf.deliveryStatus,
        messageId: build.canonicalEventId,
        eventId: build.signedEvent.id,
        relayResults: conf.relayResults,
        error: conf.error,
      };
    }

    // Return optimistic success immediately — confirmation arrives via callback.
    // The event is built and encrypted; Phase 2 publishToRelays will deliver it
    // even if sendToOpen was partially blocked. Never show "failed" at this stage.
    return {
      success: true,
      deliveryStatus: "sent_partial",
      messageId: build.canonicalEventId,
      eventId: build.signedEvent.id,
      relayResults: pool.connections
        .filter(c => c.status === "open")
        .map(c => ({ relayUrl: c.url, success: true })),
    };
  } catch (err) {
    console.error("[dm-send] pipeline error", err);
    inflight.delete(dedupKey);
    return {
      success: false,
      deliveryStatus: "failed",
      messageId: "",
      eventId: "",
      relayResults: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
};

// ---------------------------------------------------------------------------
// Send connection request (specialized send with request tags)
// ---------------------------------------------------------------------------

export const sendConnectionRequest = async (params: Readonly<{
  pool: RelayPoolContract;
  senderPublicKeyHex: PublicKeyHex;
  senderPrivateKeyHex: PrivateKeyHex;
  peerPublicKeyHex: PublicKeyHex;
  introMessage?: string;
}>): Promise<SendResult> => {
  return sendDm({
    pool: params.pool,
    senderPublicKeyHex: params.senderPublicKeyHex,
    senderPrivateKeyHex: params.senderPrivateKeyHex,
    recipientPublicKeyHex: params.peerPublicKeyHex,
    plaintext: params.introMessage || "Connection request",
    customTags: [["t", "connection-request"]],
  });
};

// ---------------------------------------------------------------------------
// Internals for testing
// ---------------------------------------------------------------------------

export const dmSendPipelineInternals = {
  buildDmEvent,
  deriveEventId,
  inflight,
};
