import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { NostrEvent } from "@dweb/nostr/nostr-event";
import { cryptoService } from "@/app/features/crypto/crypto-service";
import { PrivacySettingsService } from "@/app/features/settings/services/privacy-settings-service";
import type { ConnectionRequestStatusValue } from "@/app/features/messaging/types";
import { errorHandler } from "../lib/error-handler";
import { extractAttachmentsFromContent } from "../utils/logic";
import type { Message, IMessageQueue } from "../lib/message-queue";
import type { Subscription } from "./dm-controller-state";
import type { Dispatch, SetStateAction } from "react";
import { cacheAttachmentLocally } from "../../vault/services/local-media-store";
import { classifyDecryptFailure } from "../lib/decrypt-failure-classifier";
import { logRuntimeEvent } from "@/app/shared/runtime-log-classification";
import { normalizePublicKeyHex } from "@/app/features/profile/utils/normalize-public-key-hex";
import { incrementAbuseMetric } from "@/app/shared/abuse-observability";
import { recordMalformedEventQuarantinedRisk } from "@/app/shared/sybil-risk-signals";
import { protocolCoreAdapter } from "@/app/features/runtime/protocol-core-adapter";
import { getV090RolloutPolicy } from "@/app/features/settings/services/v090-rollout-policy";
import { requestFlowEvidenceStore } from "../services/request-flow-evidence-store";
import { deliveryDiagnosticsStore } from "../services/delivery-diagnostics-store";
import { failedIncomingEventStore } from "../services/failed-incoming-event-store";
import { readInvitationSenderProfileFromTags } from "../services/invitation-sender-profile-tag";
import { peerRelayEvidenceStore } from "../services/peer-relay-evidence-store";
import { requestEventTombstoneStore } from "../services/request-event-tombstone-store";
import { discoveryCache } from "@/app/features/search/services/discovery-cache";
import { resolveUiPerformancePolicy } from "../lib/ui-performance";
import {
  appendCanonicalContactEvent,
  appendCanonicalDecryptFailedEvent,
  appendCanonicalDmEvent,
} from "@/app/features/account-sync/services/account-event-ingest-bridge";

const extractTaggedV090Envelope = (
  tags: ReadonlyArray<ReadonlyArray<string>>
): Readonly<{ sessionId: string; envelopeVersion: "v090_x3dr"; counter?: number }> | null => {
  const versionTag = tags.find((tag) => tag[0] === "obscur-envelope-version");
  if (!versionTag || versionTag[1] !== "v090_x3dr") {
    return null;
  }
  const sessionTag = tags.find((tag) => tag[0] === "obscur-session-id");
  const sessionId = sessionTag?.[1]?.trim();
  if (!sessionId) {
    return null;
  }
  const counterTag = tags.find((tag) => tag[0] === "obscur-counter");
  const parsedCounter = Number.parseInt(counterTag?.[1] || "", 10);
  const counter = Number.isFinite(parsedCounter) && parsedCounter > 0 ? parsedCounter : undefined;
  return { sessionId, envelopeVersion: "v090_x3dr", counter };
};

const extractReferencedEventId = (tags: ReadonlyArray<ReadonlyArray<string>>): string | undefined => {
  const referenced = tags.find((tag) => tag[0] === "e")?.[1]?.trim();
  if (!referenced) return undefined;
  return referenced;
};

const shouldPersistentlySuppressDecryptFailure = (
  reason: ReturnType<typeof classifyDecryptFailure>["reason"]
): boolean => (
  reason === "expected_foreign_or_malformed" || reason === "relay_scope_mismatch"
);

const MAX_HANDLED_INCOMING_EVENT_IDS = 4000;
const MESSAGE_PROCESSING_WARNING_THRESHOLD_MS = resolveUiPerformancePolicy().warningThresholdMs;

const hasOutgoingRequestContext = (
  requestState: Readonly<{ status?: ConnectionRequestStatusValue; isOutgoing: boolean }> | null | undefined,
  evidence: Readonly<{ requestEventId?: string; receiptAckSeen: boolean; acceptSeen: boolean }>
): boolean => {
  const hasDurableOutgoingState = !!(
    requestState?.isOutgoing
    && requestState.status !== "declined"
    && requestState.status !== "canceled"
  );
  // Do not treat acceptSeen alone as proof of an active outgoing request context.
  // acceptSeen can persist after a user manually removes a connection, and that
  // stale evidence must not route generic DMs back into request-pending flows.
  return hasDurableOutgoingState || evidence.receiptAckSeen || Boolean(evidence.requestEventId);
};

export type IncomingDmParams = Readonly<{
  myPrivateKeyHex: string;
  myPublicKeyHex: PublicKeyHex;
  blocklist?: {
    isBlocked: (params: Readonly<{ publicKeyHex: PublicKeyHex }>) => boolean;
  };
  peerTrust?: {
    isAccepted: (params: Readonly<{ publicKeyHex: PublicKeyHex }>) => boolean;
    acceptPeer: (params: Readonly<{ publicKeyHex: PublicKeyHex }>) => void;
  };
  isProjectionAcceptedPeer?: (params: Readonly<{ publicKeyHex: PublicKeyHex }>) => boolean;
  requestsInbox?: {
    upsertIncoming: (params: Readonly<{
      peerPublicKeyHex: PublicKeyHex;
      plaintext: string;
      createdAtUnixSeconds: number;
      observedAtUnixSeconds?: number;
      isRequest?: boolean;
      status?: ConnectionRequestStatusValue;
      eventId?: string;
      ingestSource?: "relay_live" | "relay_sync";
    }>) => void;
    getRequestStatus: (params: Readonly<{ peerPublicKeyHex: PublicKeyHex }>) => { status?: ConnectionRequestStatusValue; isOutgoing: boolean } | null;
    setStatus: (params: Readonly<{ peerPublicKeyHex: PublicKeyHex; status: ConnectionRequestStatusValue; isOutgoing?: boolean }>) => void;
  };
  sendConnectionReceiptAck?: (params: Readonly<{ peerPublicKeyHex: PublicKeyHex; requestEventId: string }>) => Promise<void>;
  onNewMessage?: (message: Message) => void;
  onConnectionCreated?: (pubkey: PublicKeyHex) => void;
  ingestSource?: "relay_live" | "relay_sync";
  transportOwnerId?: string | null;
  controllerInstanceId?: string;
}>;

export const handleIncomingDmEvent = async <TState extends Readonly<{ messages: ReadonlyArray<Message> }>>(params: Readonly<{
  event: NostrEvent;
  relayUrl?: string;
  currentParams: IncomingDmParams;
  messageQueue: IMessageQueue | null;
  processingEvents: Set<string>;
  failedDecryptEvents: Set<string>;
  handledIncomingEventIds?: Set<string>;
  existingMessages: ReadonlyArray<Message>;
  maxMessagesInMemory: number;
  syncConversationTimestamps: Map<string, Date>;
  activeSubscriptions: Map<string, Subscription>;
  scheduleUiUpdate: (fn: () => void) => void;
  setState: Dispatch<SetStateAction<TState>>;
  createReadyState: (messages: ReadonlyArray<Message>) => TState;
  messageMemoryManager: { addMessages: (conversationId: string, messages: Message[]) => void };
  uiPerformanceMonitor: { startTracking: () => (() => { totalTime: number }) };
}>): Promise<void> => {
  const { event, relayUrl, currentParams } = params;
  const canonicalIngestSource = currentParams.ingestSource ?? "relay_live";

  const endTracking = params.uiPerformanceMonitor.startTracking();

  if (!currentParams.myPrivateKeyHex || !currentParams.myPublicKeyHex) {
    console.warn("Cannot process incoming message: identity not available");
    endTracking();
    return;
  }

  if (params.processingEvents.has(event.id)) {
    console.debug("Already processing event:", event.id);
    endTracking();
    return;
  }

  if (params.failedDecryptEvents.has(event.id)) {
    console.debug("Skipping known undecryptable event:", event.id);
    endTracking();
    return;
  }

  if (failedIncomingEventStore.isSuppressed(event.id)) {
    console.debug("Skipping persistently quarantined incoming event:", event.id);
    endTracking();
    return;
  }

  if (params.handledIncomingEventIds?.has(event.id)) {
    console.debug("Skipping already-handled incoming event:", event.id);
    endTracking();
    return;
  }

  const isDuplicateInMemory = params.existingMessages.some(m => m.eventId === event.id);
  if (isDuplicateInMemory) {
    console.debug("Ignoring duplicate message (in memory):", event.id);
    endTracking();
    return;
  }

  params.processingEvents.add(event.id);

  try {
    const isValidSignature = await cryptoService.verifyEventSignature(event);
    if (!isValidSignature) {
      console.warn("Rejected message with invalid signature:", event.id);
      return;
    }

    const senderPubkey = normalizePublicKeyHex(event.pubkey);
    if (!senderPubkey) {
      incrementAbuseMetric("quarantined_malformed_event");
      recordMalformedEventQuarantinedRisk();
      logRuntimeEvent(
        "incoming_dm.invalid_sender_pubkey",
        "degraded",
        ["Ignoring incoming DM with invalid sender pubkey format:", event.id],
      );
      return;
    }

    const recipientTag = event.tags?.find(tag => tag[0] === "p");
    const normalizedRecipient = normalizePublicKeyHex(recipientTag?.[1]);
    deliveryDiagnosticsStore.markIncoming({
      eventId: event.id,
      kind: event.kind,
      senderPubkey,
      recipientPubkey: normalizedRecipient ?? undefined,
      relayUrl,
      action: "seen",
    });
    if (!normalizedRecipient || normalizedRecipient !== currentParams.myPublicKeyHex) {
      if (!normalizedRecipient) {
        incrementAbuseMetric("quarantined_malformed_event");
        recordMalformedEventQuarantinedRisk();
      }
      deliveryDiagnosticsStore.markIncoming({
        eventId: event.id,
        kind: event.kind,
        senderPubkey,
        recipientPubkey: normalizedRecipient ?? undefined,
        relayUrl,
        action: "ignored",
        reason: !normalizedRecipient ? "missing_or_invalid_recipient_tag" : "recipient_mismatch",
      });
      return;
    }

    if (currentParams.blocklist?.isBlocked({ publicKeyHex: senderPubkey })) {
      console.log("Filtered message from blocked sender:", senderPubkey);
      return;
    }

    const envelopeMetadata = extractTaggedV090Envelope(event.tags || []);
    if (envelopeMetadata?.envelopeVersion === "v090_x3dr") {
      const rolloutPolicy = getV090RolloutPolicy(PrivacySettingsService.getSettings());
      if (!rolloutPolicy.protocolCoreEnabled || !rolloutPolicy.x3dhRatchetEnabled) {
        logRuntimeEvent(
          "incoming_dm.protocol_verify.skipped_by_policy",
          "degraded",
          ["Skipped v090_x3dr DM because protocol rollout flags are disabled:", event.id],
        );
        return;
      }

      const verifyResult = await protocolCoreAdapter.verifyMessageEnvelope({
        sessionId: envelopeMetadata.sessionId,
        messageId: event.id,
        envelope: event.content,
        counter: envelopeMetadata.counter,
      });
      if (!verifyResult.ok) {
        const message = verifyResult.message || "Protocol verification failed";
        logRuntimeEvent(
          "incoming_dm.protocol_verify.command_failed",
          "degraded",
          [`Rejected incoming v090_x3dr DM: ${message}`, event.id],
        );
        return;
      }

      if (!verifyResult.value.ok) {
        logRuntimeEvent(
          `incoming_dm.protocol_verify.rejected.${verifyResult.value.reason ?? "failed"}`,
          "degraded",
          ["Rejected incoming v090_x3dr DM by protocol verifier:", event.id],
        );
        return;
      }
    }

    let plaintext: string;
    let effectiveTags = event.tags;
    let actualSenderPubkey: PublicKeyHex | null = senderPubkey;
    let usedEventId = event.id;
    let usedCreatedAt = event.created_at;
    const observedAtUnixSeconds = Math.floor(Date.now() / 1000);

    try {
      if (event.kind === 1059) {
        const rumor = await cryptoService.decryptGiftWrap(event, currentParams.myPrivateKeyHex);
        // Never auto-join from an incoming invite payload. The UI invite card
        // must be explicitly accepted by the user before any local membership changes.
        plaintext = rumor.content;
        effectiveTags = rumor.tags;
        actualSenderPubkey = normalizePublicKeyHex(rumor.pubkey);
        usedEventId = rumor.id;
        usedCreatedAt = rumor.created_at;
      } else {
        plaintext = await cryptoService.decryptDM(event.content, senderPubkey, currentParams.myPrivateKeyHex);
      }
    } catch (decryptError) {
      const decryptionClass = classifyDecryptFailure(decryptError);
      const requestStatusAtDecrypt = currentParams.requestsInbox?.getRequestStatus({ peerPublicKeyHex: senderPubkey });
      const isAcceptedSenderAtDecrypt = !!(
        currentParams.peerTrust?.isAccepted({ publicKeyHex: senderPubkey })
        || requestStatusAtDecrypt?.status === "accepted"
      );
      const effectiveDecryptionClass = (
        decryptionClass.reason === "regression" && !isAcceptedSenderAtDecrypt
      )
        ? {
            reason: "expected_foreign_or_malformed" as const,
            runtimeClass: "expected" as const,
            shouldSurfaceToUser: false,
          }
        : decryptionClass;
      if (effectiveDecryptionClass.shouldSurfaceToUser) {
        errorHandler.handleDecryptionError(
          decryptError instanceof Error ? decryptError : new Error("Decryption failed"),
          { eventId: event.id, sender: senderPubkey, reason: effectiveDecryptionClass.reason }
        );
      }
      logRuntimeEvent(
        `incoming_dm.decrypt_failed.${effectiveDecryptionClass.reason}`,
        effectiveDecryptionClass.runtimeClass,
        ["Incoming event could not be decrypted:", event.id]
      );
      deliveryDiagnosticsStore.markIncoming({
        eventId: event.id,
        kind: event.kind,
        senderPubkey,
        recipientPubkey: normalizedRecipient,
        relayUrl,
        action: "decrypt_failed",
        reason: effectiveDecryptionClass.reason,
      });
      if (shouldPersistentlySuppressDecryptFailure(effectiveDecryptionClass.reason)) {
        params.failedDecryptEvents.add(event.id);
        failedIncomingEventStore.suppress(event.id);
        void appendCanonicalDecryptFailedEvent({
          accountPublicKeyHex: currentParams.myPublicKeyHex,
          peerPublicKeyHex: senderPubkey,
          messageId: event.id,
          reason: effectiveDecryptionClass.reason,
          idempotencySuffix: event.id,
          source: canonicalIngestSource,
        });
        if (params.failedDecryptEvents.size > 2000) {
          params.failedDecryptEvents.clear();
        }
      }
      return;
    }

    if (!actualSenderPubkey) {
      incrementAbuseMetric("quarantined_malformed_event");
      recordMalformedEventQuarantinedRisk();
      logRuntimeEvent(
        "incoming_dm.invalid_decrypted_sender_pubkey",
        "degraded",
        ["Ignoring incoming DM with invalid decrypted sender pubkey format:", usedEventId],
      );
      return;
    }

    if (params.handledIncomingEventIds?.has(usedEventId)) {
      console.debug("Skipping already-handled incoming event payload:", usedEventId);
      return;
    }
    if (params.handledIncomingEventIds) {
      params.handledIncomingEventIds.add(event.id);
      params.handledIncomingEventIds.add(usedEventId);
      if (params.handledIncomingEventIds.size > MAX_HANDLED_INCOMING_EVENT_IDS) {
        params.handledIncomingEventIds.clear();
        params.handledIncomingEventIds.add(event.id);
        params.handledIncomingEventIds.add(usedEventId);
      }
    }

    const isAcceptedByTrust = currentParams.peerTrust?.isAccepted({ publicKeyHex: actualSenderPubkey }) || false;
    const isAcceptedByProjection = currentParams.isProjectionAcceptedPeer?.({ publicKeyHex: actualSenderPubkey }) || false;
    const requestState = currentParams.requestsInbox?.getRequestStatus({ peerPublicKeyHex: actualSenderPubkey });
    const hasAcceptedRequestState = requestState?.status === "accepted";
    const requestEvidence = requestFlowEvidenceStore.get(actualSenderPubkey);
    const hasDurableAcceptEvidence = Boolean(
      requestEvidence.acceptSeen
      && (
        isAcceptedByProjection
        || hasAcceptedRequestState
        || (
          requestState?.isOutgoing
          && requestState.status !== "declined"
          && requestState.status !== "canceled"
        )
      )
    );
    const isAcceptedContact = isAcceptedByTrust
      || hasAcceptedRequestState
      || isAcceptedByProjection
      || hasDurableAcceptEvidence;
    if ((hasAcceptedRequestState || isAcceptedByProjection || hasDurableAcceptEvidence) && !isAcceptedByTrust) {
      currentParams.peerTrust?.acceptPeer({ publicKeyHex: actualSenderPubkey });
    }
    if (
      currentParams.requestsInbox
      && requestState
      && requestState.status !== "accepted"
      && (isAcceptedByProjection || hasDurableAcceptEvidence)
    ) {
      currentParams.requestsInbox.setStatus({
        peerPublicKeyHex: actualSenderPubkey,
        status: "accepted",
        isOutgoing: requestState.isOutgoing,
      });
    }
    const hasOutgoingRequestEvidence = hasOutgoingRequestContext(requestState, requestEvidence);
    const isConnectionRequest = effectiveTags?.some(tag => tag[0] === "t" && tag[1] === "connection-request");
    const isConnectionAccept = effectiveTags?.some(tag => tag[0] === "t" && tag[1] === "connection-accept");
    const isConnectionDecline = effectiveTags?.some(tag => tag[0] === "t" && tag[1] === "connection-decline");
    const isConnectionCancel = effectiveTags?.some(tag => tag[0] === "t" && tag[1] === "connection-cancel");
    const isConnectionReceipt = effectiveTags?.some(tag =>
      tag[0] === "t" && (tag[1] === "connection-received" || tag[1] === "connection-receipt")
    );
    if (
      relayUrl
      && (
        isAcceptedContact
        || hasOutgoingRequestEvidence
        || isConnectionRequest
        || isConnectionAccept
        || isConnectionDecline
        || isConnectionCancel
        || isConnectionReceipt
      )
    ) {
      peerRelayEvidenceStore.recordInboundRelay({
        peerPublicKeyHex: actualSenderPubkey,
        relayUrl,
      });
    }
    if (isConnectionRequest) {
      const senderProfile = readInvitationSenderProfileFromTags(effectiveTags);
      if (senderProfile) {
        discoveryCache.upsertProfile({
          pubkey: actualSenderPubkey,
          displayName: senderProfile.displayName,
          about: senderProfile.about,
          picture: senderProfile.avatarUrl,
          nip05: senderProfile.nip05,
        });
      }
    }

    const privacySettings = PrivacySettingsService.getSettings();
    if (
      privacySettings.dmPrivacy === "contacts-only"
      && !isAcceptedContact
      && !hasOutgoingRequestEvidence
      && !isConnectionRequest
      && !isConnectionAccept
      && !isConnectionDecline
      && !isConnectionCancel
      && !isConnectionReceipt
    ) {
      console.log("Filtered message from stranger due to \"Connections Only\" privacy setting:", actualSenderPubkey);
      return;
    }

    if (isConnectionReceipt) {
      deliveryDiagnosticsStore.markIncoming({
        eventId: usedEventId,
        kind: event.kind,
        senderPubkey,
        recipientPubkey: currentParams.myPublicKeyHex,
        relayUrl,
        action: "receipt_ack",
        routedPeerPubkey: actualSenderPubkey,
      });
      requestFlowEvidenceStore.markReceiptAck({
        peerPublicKeyHex: actualSenderPubkey,
        requestEventId: extractReferencedEventId(effectiveTags || []),
      });
      const hasOutgoingRequestState = !!(requestState?.isOutgoing && (requestState.status === "pending" || !requestState.status));
      if (hasOutgoingRequestState) {
        currentParams.requestsInbox?.setStatus({
          peerPublicKeyHex: actualSenderPubkey,
          status: "pending",
          isOutgoing: true
        });
      }
      return;
    }

    if (isConnectionDecline) {
      deliveryDiagnosticsStore.markIncoming({
        eventId: usedEventId,
        kind: event.kind,
        senderPubkey,
        recipientPubkey: currentParams.myPublicKeyHex,
        relayUrl,
        action: "requests_inbox",
        routedPeerPubkey: actualSenderPubkey,
        reason: "connection_decline",
      });
      currentParams.requestsInbox?.setStatus({
        peerPublicKeyHex: actualSenderPubkey,
        status: "declined",
        isOutgoing: true,
      });
      void appendCanonicalContactEvent({
        accountPublicKeyHex: currentParams.myPublicKeyHex,
        peerPublicKeyHex: actualSenderPubkey,
        type: "CONTACT_DECLINED",
        direction: "outgoing",
        requestEventId: extractReferencedEventId(effectiveTags || []),
        idempotencySuffix: usedEventId,
        source: canonicalIngestSource,
      });
      requestFlowEvidenceStore.reset(actualSenderPubkey);
      return;
    }

    if (isConnectionCancel) {
      deliveryDiagnosticsStore.markIncoming({
        eventId: usedEventId,
        kind: event.kind,
        senderPubkey,
        recipientPubkey: currentParams.myPublicKeyHex,
        relayUrl,
        action: "requests_inbox",
        routedPeerPubkey: actualSenderPubkey,
        reason: "connection_cancel",
      });
      currentParams.requestsInbox?.setStatus({
        peerPublicKeyHex: actualSenderPubkey,
        status: "canceled",
        isOutgoing: false,
      });
      void appendCanonicalContactEvent({
        accountPublicKeyHex: currentParams.myPublicKeyHex,
        peerPublicKeyHex: actualSenderPubkey,
        type: "CONTACT_CANCELED",
        direction: "incoming",
        requestEventId: extractReferencedEventId(effectiveTags || []),
        idempotencySuffix: usedEventId,
        source: canonicalIngestSource,
      });
      requestFlowEvidenceStore.reset(actualSenderPubkey);
      return;
    }

    let acceptedViaConnectionAccept = false;
    if (isConnectionAccept) {
      requestFlowEvidenceStore.markAccept({
        peerPublicKeyHex: actualSenderPubkey,
        requestEventId: extractReferencedEventId(effectiveTags || []),
      });
      const rs = currentParams.requestsInbox?.getRequestStatus({ peerPublicKeyHex: actualSenderPubkey });
      if (hasOutgoingRequestContext(rs, requestFlowEvidenceStore.get(actualSenderPubkey))) {
        logRuntimeEvent(
          "incoming_dm.connection_accept_acknowledged",
          "expected",
          [
            "Detected connection-accept acknowledgement from:",
            actualSenderPubkey,
            ". Marking as accepted.",
            {
              transportOwnerId: currentParams.transportOwnerId ?? null,
              controllerInstanceId: currentParams.controllerInstanceId ?? null,
            },
          ],
          { windowMs: 20_000, maxPerWindow: 1, summaryEverySuppressed: 20 },
        );
        currentParams.peerTrust?.acceptPeer({ publicKeyHex: actualSenderPubkey });
        currentParams.requestsInbox?.setStatus({
          peerPublicKeyHex: actualSenderPubkey,
          status: "accepted",
          isOutgoing: true
        });
        void appendCanonicalContactEvent({
          accountPublicKeyHex: currentParams.myPublicKeyHex,
          peerPublicKeyHex: actualSenderPubkey,
          type: "CONTACT_ACCEPTED",
          direction: "outgoing",
          requestEventId: extractReferencedEventId(effectiveTags || []),
          idempotencySuffix: usedEventId,
          source: canonicalIngestSource,
        });
        currentParams.onConnectionCreated?.(actualSenderPubkey);
        acceptedViaConnectionAccept = true;
      }
    }

    if (!isAcceptedContact && !acceptedViaConnectionAccept) {
      if (hasOutgoingRequestEvidence) {
        if (requestEventTombstoneStore.isSuppressed(usedEventId)) {
          deliveryDiagnosticsStore.markIncoming({
            eventId: usedEventId,
            kind: event.kind,
            senderPubkey,
            recipientPubkey: currentParams.myPublicKeyHex,
            relayUrl,
            action: "ignored",
            routedPeerPubkey: actualSenderPubkey,
            reason: "request_event_replay_suppressed",
          });
          return;
        }
        deliveryDiagnosticsStore.markIncoming({
          eventId: usedEventId,
          kind: event.kind,
          senderPubkey,
          recipientPubkey: currentParams.myPublicKeyHex,
          relayUrl,
          action: "requests_inbox",
          routedPeerPubkey: actualSenderPubkey,
          reason: "awaiting_explicit_accept",
        });
        logRuntimeEvent(
          "incoming_dm.pending_peer_retained",
          "expected",
          [
            "Received message from pending peer; retaining request as pending until explicit accept:",
            actualSenderPubkey,
          ],
          { windowMs: 20_000, maxPerWindow: 1, summaryEverySuppressed: 20 },
        );
        currentParams.requestsInbox?.upsertIncoming({
          peerPublicKeyHex: actualSenderPubkey,
          plaintext,
          createdAtUnixSeconds: usedCreatedAt,
          observedAtUnixSeconds,
          isRequest: isConnectionRequest,
          // Keep request context visible/consistent even for generic replies from peers
          // that already have durable outgoing-request evidence.
          status: requestState?.status ?? "pending",
          eventId: usedEventId,
          ingestSource: canonicalIngestSource,
        });
        requestEventTombstoneStore.suppress(usedEventId);
        if (isConnectionRequest) {
          void appendCanonicalContactEvent({
            accountPublicKeyHex: currentParams.myPublicKeyHex,
            peerPublicKeyHex: actualSenderPubkey,
            type: "CONTACT_REQUEST_RECEIVED",
            direction: "incoming",
            requestEventId: usedEventId,
            idempotencySuffix: usedEventId,
            source: canonicalIngestSource,
          });
        }
        return;
      } else {
        if (isConnectionRequest && currentParams.requestsInbox) {
          if (requestEventTombstoneStore.isSuppressed(usedEventId)) {
            deliveryDiagnosticsStore.markIncoming({
              eventId: usedEventId,
              kind: event.kind,
              senderPubkey,
              recipientPubkey: currentParams.myPublicKeyHex,
              relayUrl,
              action: "ignored",
              routedPeerPubkey: actualSenderPubkey,
              reason: "request_event_replay_suppressed",
            });
            return;
          }
          currentParams.requestsInbox.upsertIncoming({
            peerPublicKeyHex: actualSenderPubkey,
            plaintext,
            createdAtUnixSeconds: usedCreatedAt,
            observedAtUnixSeconds,
            isRequest: isConnectionRequest,
            status: isConnectionRequest ? "pending" : undefined,
            eventId: usedEventId,
            ingestSource: canonicalIngestSource,
          });
          requestEventTombstoneStore.suppress(usedEventId);
          void appendCanonicalContactEvent({
            accountPublicKeyHex: currentParams.myPublicKeyHex,
            peerPublicKeyHex: actualSenderPubkey,
            type: "CONTACT_REQUEST_RECEIVED",
            direction: "incoming",
            requestEventId: usedEventId,
            idempotencySuffix: usedEventId,
            source: canonicalIngestSource,
          });
          deliveryDiagnosticsStore.markIncoming({
            eventId: usedEventId,
            kind: event.kind,
            senderPubkey,
            recipientPubkey: currentParams.myPublicKeyHex,
            relayUrl,
            action: "requests_inbox",
            routedPeerPubkey: actualSenderPubkey,
            reason: isConnectionRequest ? "connection_request" : "unknown_sender_message",
          });
          logRuntimeEvent(
            "incoming_dm.unknown_sender_routed_to_requests_inbox",
            "expected",
            ["Routed message from unknown sender to requests inbox:", actualSenderPubkey, { isRequest: isConnectionRequest }],
            { windowMs: 20_000, maxPerWindow: 1, summaryEverySuppressed: 20 },
          );
          if (isConnectionRequest) {
            requestFlowEvidenceStore.markRequestPublished({
              peerPublicKeyHex: actualSenderPubkey,
              requestEventId: usedEventId,
            });
            void currentParams.sendConnectionReceiptAck?.({
              peerPublicKeyHex: actualSenderPubkey,
              requestEventId: usedEventId
            });
          }
          return;
        }
        deliveryDiagnosticsStore.markIncoming({
          eventId: usedEventId,
          kind: event.kind,
          senderPubkey,
          recipientPubkey: currentParams.myPublicKeyHex,
          relayUrl,
          action: "ignored",
          routedPeerPubkey: actualSenderPubkey,
          reason: "unknown_sender_without_request_context",
        });
        return;
      }
    }

    const conversationId = [currentParams.myPublicKeyHex, actualSenderPubkey].sort().join(":");

    const message: Message = {
      id: usedEventId,
      conversationId,
      content: plaintext,
      kind: "user",
      timestamp: new Date(usedCreatedAt * 1000),
      isOutgoing: false,
      status: "delivered",
      eventId: usedEventId,
      eventCreatedAt: new Date(usedCreatedAt * 1000),
      senderPubkey: actualSenderPubkey,
      recipientPubkey: currentParams.myPublicKeyHex,
      encryptedContent: event.content,
      attachments: extractAttachmentsFromContent(plaintext)
    };

    if (message.attachments && message.attachments.length > 0) {
      void Promise.all(
        message.attachments.map((attachment) => cacheAttachmentLocally(attachment, "received"))
      ).catch((e) => {
        logRuntimeEvent(
          "incoming_dm.cache_received_attachments_failed",
          "degraded",
          ["[Vault] Failed to cache received attachments locally:", e]
        );
      });
    }

    if (params.messageQueue) {
      const existingMessage = await params.messageQueue.getMessage(usedEventId);
      if (existingMessage) {
        console.debug("Ignoring duplicate message (found in storage):", usedEventId);
        return;
      }
    }

    if (params.messageQueue) {
      try {
        await params.messageQueue.persistMessage(message);
      } catch (storageError) {
        errorHandler.handleStorageError(
          storageError instanceof Error ? storageError : new Error("Failed to persist incoming message"),
          { eventId: event.id, sender: senderPubkey }
        );
        console.warn("Failed to persist incoming message:", storageError);
      }
    }

    params.syncConversationTimestamps.set(conversationId, message.timestamp);
    void appendCanonicalDmEvent({
      accountPublicKeyHex: currentParams.myPublicKeyHex,
      peerPublicKeyHex: actualSenderPubkey,
      type: "DM_RECEIVED",
      conversationId,
      messageId: usedEventId,
      eventCreatedAtUnixSeconds: usedCreatedAt,
      plaintextPreview: plaintext,
      idempotencySuffix: usedEventId,
      source: canonicalIngestSource,
    });
    if (isAcceptedContact) {
      deliveryDiagnosticsStore.markIncoming({
        eventId: usedEventId,
        kind: event.kind,
        senderPubkey,
        recipientPubkey: currentParams.myPublicKeyHex,
        relayUrl,
        action: "accepted_contact",
        routedPeerPubkey: actualSenderPubkey,
      });
    }

    params.scheduleUiUpdate(() => {
      params.setState((prev: TState) => {
        const p = prev;
        const alreadyExists = p.messages.some((m: Message) => m.eventId === usedEventId);
        if (alreadyExists) {
          console.debug("Ignoring duplicate message (race condition caught):", usedEventId);
          return prev;
        }

        const updatedMessages: Message[] = [message, ...p.messages];
        const sortedMessages: Message[] = updatedMessages.sort((a: Message, b: Message) => b.timestamp.getTime() - a.timestamp.getTime());
        const limitedMessages: ReadonlyArray<Message> = sortedMessages.slice(0, params.maxMessagesInMemory);

        params.messageMemoryManager.addMessages(conversationId, [...limitedMessages]);

        return {
          ...params.createReadyState(limitedMessages),
          subscriptions: Array.from(params.activeSubscriptions.values())
        } as TState;
      });
    });

    console.log("Processed incoming message from accepted connection:", usedEventId, {
      transportOwnerId: currentParams.transportOwnerId ?? null,
      controllerInstanceId: currentParams.controllerInstanceId ?? null,
    });

    if (currentParams.onNewMessage) {
      currentParams.onNewMessage(message);
    }

    const metric = endTracking();
    if (metric.totalTime > MESSAGE_PROCESSING_WARNING_THRESHOLD_MS) {
      console.warn(
        `Message processing took ${metric.totalTime.toFixed(2)}ms (target: <${MESSAGE_PROCESSING_WARNING_THRESHOLD_MS}ms)`
      );
    }
  } catch (error) {
    console.warn("Error processing incoming event:", error);
    endTracking();
  } finally {
    params.processingEvents.delete(event.id);
  }
};
