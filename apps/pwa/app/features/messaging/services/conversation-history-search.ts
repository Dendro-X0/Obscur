import type { Message, PersistedMessage } from "@/app/features/messaging/types";
import { messageMatchesSearchJumpTarget } from "@/app/features/messaging/components/message-search-jump";
import { buildMessageSearchIndexText } from "@/app/features/messaging/services/message-search-index";
import { getVoiceNoteAttachmentMetadata } from "@/app/features/messaging/services/voice-note-metadata";

export type ConversationHistorySearchResult = Readonly<{
  messageId: string;
  timestampMs: number;
  preview: string;
  resultKind: "text" | "voice_note";
  voiceDurationLabel: string | null;
}>;

const MIN_HISTORY_SEARCH_QUERY_LENGTH = 2;

const normalizeHistorySearchQuery = (query: string): string => query.trim().toLowerCase();

export const messageMatchesHistorySearchQuery = (
  message: Readonly<{ content?: unknown; attachments?: unknown }>,
  query: string,
): boolean => {
  const normalized = normalizeHistorySearchQuery(query);
  if (normalized.length < MIN_HISTORY_SEARCH_QUERY_LENGTH) {
    return false;
  }
  return buildMessageSearchIndexText(message).includes(normalized);
};

const toVoiceNoteSearchFields = (
  attachments: unknown,
): Readonly<{ isVoiceNote: boolean; durationLabel: string | null }> => {
  const messageAttachments = Array.isArray(attachments) ? attachments : [];
  const voiceNoteMetadata = messageAttachments
    .map((attachment) => getVoiceNoteAttachmentMetadata({
      kind: typeof attachment === "object" && attachment !== null && typeof attachment.kind === "string"
        ? attachment.kind
        : null,
      fileName: typeof attachment === "object" && attachment !== null && typeof attachment.fileName === "string"
        ? attachment.fileName
        : null,
      contentType: typeof attachment === "object" && attachment !== null && typeof attachment.contentType === "string"
        ? attachment.contentType
        : null,
    }))
    .find((metadata) => metadata.isVoiceNote);
  return {
    isVoiceNote: voiceNoteMetadata?.isVoiceNote ?? false,
    durationLabel: voiceNoteMetadata?.durationLabel ?? null,
  };
};

export const mapPersistedMessageToHistorySearchResult = (
  message: PersistedMessage,
): ConversationHistorySearchResult => {
  const contentPreview = typeof message.content === "string" ? message.content : "";
  const voiceFields = toVoiceNoteSearchFields(message.attachments);
  return {
    messageId: message.id,
    timestampMs: message.timestampMs,
    preview: contentPreview.trim().length > 0
      ? contentPreview
      : (voiceFields.isVoiceNote ? "Voice note" : ""),
    resultKind: voiceFields.isVoiceNote ? "voice_note" : "text",
    voiceDurationLabel: voiceFields.durationLabel,
  };
};

export const mapLiveMessageToHistorySearchResult = (
  message: Message,
): ConversationHistorySearchResult | null => {
  if (message.deletedAt) {
    return null;
  }
  if (message.kind !== "user") {
    return null;
  }
  const voiceFields = toVoiceNoteSearchFields(message.attachments);
  const preview = message.content.trim().length > 0
    ? message.content
    : (voiceFields.isVoiceNote ? "Voice note" : "");
  return {
    messageId: message.id,
    timestampMs: message.timestamp.getTime(),
    preview,
    resultKind: voiceFields.isVoiceNote ? "voice_note" : "text",
    voiceDurationLabel: voiceFields.durationLabel,
  };
};

export const searchLiveConversationMessages = (
  messages: ReadonlyArray<Message>,
  query: string,
  limit: number,
): ReadonlyArray<ConversationHistorySearchResult> => {
  const normalized = normalizeHistorySearchQuery(query);
  if (normalized.length < MIN_HISTORY_SEARCH_QUERY_LENGTH || limit <= 0) {
    return [];
  }

  const results: ConversationHistorySearchResult[] = [];
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message) {
      continue;
    }
    if (!messageMatchesHistorySearchQuery(message, normalized)) {
      continue;
    }
    const mapped = mapLiveMessageToHistorySearchResult(message);
    if (!mapped) {
      continue;
    }
    results.push(mapped);
    if (results.length >= limit) {
      break;
    }
  }
  return results;
};

const historyResultMatchesLiveMessage = (
  result: ConversationHistorySearchResult,
  message: Message,
): boolean => messageMatchesSearchJumpTarget(message, result.messageId)
  || Math.abs(message.timestamp.getTime() - result.timestampMs) <= 1_000;

export const resolveHistorySearchResultsForLiveMessages = (
  results: ReadonlyArray<ConversationHistorySearchResult>,
  liveMessages: ReadonlyArray<Message>,
): ReadonlyArray<ConversationHistorySearchResult> => (
  results.map((result) => {
    const matched = liveMessages.find((message) => historyResultMatchesLiveMessage(result, message));
    if (!matched) {
      return result;
    }
    return {
      ...result,
      messageId: matched.id,
      timestampMs: matched.timestamp.getTime(),
    };
  })
);

export const mergeConversationHistorySearchResults = (
  primary: ReadonlyArray<ConversationHistorySearchResult>,
  supplemental: ReadonlyArray<ConversationHistorySearchResult>,
  limit: number,
): ReadonlyArray<ConversationHistorySearchResult> => {
  const merged: ConversationHistorySearchResult[] = [];
  const isDuplicate = (candidate: ConversationHistorySearchResult): boolean => (
    merged.some((existing) => (
      existing.messageId === candidate.messageId
      || (
        Math.abs(existing.timestampMs - candidate.timestampMs) <= 1_000
        && existing.preview.trim().toLowerCase() === candidate.preview.trim().toLowerCase()
      )
    ))
  );

  supplemental.forEach((result) => {
    if (!isDuplicate(result)) {
      merged.push(result);
    }
  });
  primary.forEach((result) => {
    if (!isDuplicate(result)) {
      merged.push(result);
    }
  });

  return merged
    .sort((left, right) => right.timestampMs - left.timestampMs)
    .slice(0, limit);
};
