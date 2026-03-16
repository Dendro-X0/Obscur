import type {
  AccountEvent,
  AccountProjectionSnapshot,
  ContactProjection,
  MessageProjection,
} from "../account-event-contracts";

const emptySnapshot = (profileId: string, accountPublicKeyHex: string): AccountProjectionSnapshot => ({
  profileId,
  accountPublicKeyHex: accountPublicKeyHex as any,
  contactsByPeer: {},
  conversationsById: {},
  messagesByConversationId: {},
  sync: {
    checkpointsByTimelineKey: {},
    bootstrapImportApplied: false,
  },
  lastSequence: 0,
  updatedAtUnixMs: Date.now(),
});

const applyContactProjection = (
  current: AccountProjectionSnapshot,
  nextContact: ContactProjection
): AccountProjectionSnapshot => {
  return {
    ...current,
    contactsByPeer: {
      ...current.contactsByPeer,
      [nextContact.peerPublicKeyHex]: nextContact,
    },
  };
};

const toContactStatus = (
  type: AccountEvent["type"]
): ContactProjection["status"] | null => {
  switch (type) {
    case "CONTACT_ACCEPTED":
      return "accepted";
    case "CONTACT_DECLINED":
      return "declined";
    case "CONTACT_CANCELED":
      return "canceled";
    case "CONTACT_REMOVED":
      return "none";
    case "CONTACT_REQUEST_RECEIVED":
    case "CONTACT_REQUEST_SENT":
      return "pending";
    default:
      return null;
  }
};

const shouldBlockContactTransition = (
  current: ContactProjection | undefined,
  incomingStatus: ContactProjection["status"]
): boolean => {
  if (!current) {
    return false;
  }
  // Accepted is sticky until explicit removal. This prevents stale request replay
  // from regressing accepted peers back to pending/stranger on new-device bootstrap.
  return current.status === "accepted"
    && incomingStatus !== "accepted"
    && incomingStatus !== "none";
};

const toConversationPreview = (value: string): string => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= 140) {
    return normalized;
  }
  return `${normalized.slice(0, 140)}...`;
};

const upsertMessage = (
  current: AccountProjectionSnapshot,
  message: MessageProjection
): AccountProjectionSnapshot => {
  const existingConversationMessages = current.messagesByConversationId[message.conversationId] ?? [];
  const byMessageId = new Map(existingConversationMessages.map((entry) => [entry.messageId, entry] as const));
  byMessageId.set(message.messageId, message);
  const nextMessages = Array.from(byMessageId.values()).sort((left, right) => {
    if (left.eventCreatedAtUnixSeconds !== right.eventCreatedAtUnixSeconds) {
      return left.eventCreatedAtUnixSeconds - right.eventCreatedAtUnixSeconds;
    }
    return left.messageId.localeCompare(right.messageId);
  });
  const currentConversation = current.conversationsById[message.conversationId];
  const nextConversation = {
    conversationId: message.conversationId,
    peerPublicKeyHex: message.peerPublicKeyHex,
    lastMessagePreview: toConversationPreview(message.plaintextPreview),
    lastMessageAtUnixMs: Math.max(
      currentConversation?.lastMessageAtUnixMs ?? 0,
      message.eventCreatedAtUnixSeconds * 1000
    ),
    unreadCount: message.direction === "incoming"
      ? (currentConversation?.unreadCount ?? 0) + 1
      : (currentConversation?.unreadCount ?? 0),
  };
  return {
    ...current,
    conversationsById: {
      ...current.conversationsById,
      [message.conversationId]: nextConversation,
    },
    messagesByConversationId: {
      ...current.messagesByConversationId,
      [message.conversationId]: nextMessages,
    },
  };
};

export const reduceAccountEvent = (
  currentSnapshot: AccountProjectionSnapshot | null,
  accountEvent: AccountEvent,
  sequence: number
): AccountProjectionSnapshot => {
  const current = currentSnapshot ?? emptySnapshot(accountEvent.profileId, accountEvent.accountPublicKeyHex);
  let next = current;

  switch (accountEvent.type) {
    case "CONTACT_REQUEST_RECEIVED":
    case "CONTACT_REQUEST_SENT":
    case "CONTACT_ACCEPTED":
    case "CONTACT_DECLINED":
    case "CONTACT_CANCELED":
    case "CONTACT_REMOVED": {
      const incomingStatus = toContactStatus(accountEvent.type);
      if (!incomingStatus) {
        break;
      }
      const currentContact = next.contactsByPeer[accountEvent.peerPublicKeyHex];
      if (shouldBlockContactTransition(currentContact, incomingStatus)) {
        break;
      }
      next = applyContactProjection(next, {
        peerPublicKeyHex: accountEvent.peerPublicKeyHex,
        direction: accountEvent.direction,
        status: incomingStatus,
        lastEvidenceAtUnixMs: accountEvent.observedAtUnixMs,
        lastEventId: accountEvent.eventId,
        lastRequestEventId: "requestEventId" in accountEvent ? accountEvent.requestEventId : undefined,
      });
      break;
    }
    case "DM_RECEIVED": {
      next = upsertMessage(next, {
        messageId: accountEvent.messageId,
        conversationId: accountEvent.conversationId,
        peerPublicKeyHex: accountEvent.peerPublicKeyHex,
        direction: "incoming",
        eventCreatedAtUnixSeconds: accountEvent.eventCreatedAtUnixSeconds,
        plaintextPreview: accountEvent.plaintextPreview,
        observedAtUnixMs: accountEvent.observedAtUnixMs,
      });
      break;
    }
    case "DM_SENT_CONFIRMED": {
      next = upsertMessage(next, {
        messageId: accountEvent.messageId,
        conversationId: accountEvent.conversationId,
        peerPublicKeyHex: accountEvent.peerPublicKeyHex,
        direction: "outgoing",
        eventCreatedAtUnixSeconds: accountEvent.eventCreatedAtUnixSeconds,
        plaintextPreview: accountEvent.plaintextPreview,
        observedAtUnixMs: accountEvent.observedAtUnixMs,
      });
      break;
    }
    case "DM_DECRYPT_FAILED_QUARANTINED":
      // Quarantined decrypt failures are diagnostics-only for projection v1.
      break;
    case "SYNC_CHECKPOINT_ADVANCED": {
      const currentCheckpoint = next.sync.checkpointsByTimelineKey[accountEvent.timelineKey] ?? 0;
      next = {
        ...next,
        sync: {
          ...next.sync,
          checkpointsByTimelineKey: {
            ...next.sync.checkpointsByTimelineKey,
            [accountEvent.timelineKey]: Math.max(currentCheckpoint, accountEvent.lastProcessedAtUnixSeconds),
          },
        },
      };
      break;
    }
    case "BOOTSTRAP_IMPORT_APPLIED": {
      next = {
        ...next,
        sync: {
          ...next.sync,
          bootstrapImportApplied: true,
        },
      };
      break;
    }
    default:
      break;
  }

  return {
    ...next,
    lastSequence: Math.max(sequence, next.lastSequence),
    updatedAtUnixMs: Math.max(next.updatedAtUnixMs, accountEvent.observedAtUnixMs),
  };
};

export const replayAccountEvents = (
  events: ReadonlyArray<Readonly<{ sequence: number; event: AccountEvent }>>
): AccountProjectionSnapshot | null => {
  if (events.length === 0) {
    return null;
  }
  const ordered = [...events].sort((left, right) => left.sequence - right.sequence);
  let next: AccountProjectionSnapshot | null = null;
  for (const entry of ordered) {
    next = reduceAccountEvent(next, entry.event, entry.sequence);
  }
  return next;
};

export const accountEventReducerInternals = {
  emptySnapshot,
  upsertMessage,
};
