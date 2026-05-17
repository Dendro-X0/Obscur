import {
  buildVoiceNoteSearchTokens,
  getVoiceNoteAttachmentMetadata,
} from "@/app/features/messaging/services/voice-note-metadata";

type SearchableAttachment = Readonly<{
  kind?: unknown;
  fileName?: unknown;
  contentType?: unknown;
  url?: unknown;
}>;

type SearchableMessage = Readonly<{
  content?: unknown;
  attachments?: unknown;
}>;

const toNormalizedToken = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
};

const toSearchableAttachments = (value: unknown): ReadonlyArray<SearchableAttachment> => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is SearchableAttachment => (
    typeof entry === "object" && entry !== null
  ));
};

export const buildMessageSearchIndexText = (message: SearchableMessage): string => {
  const tokenSet = new Set<string>();
  const addToken = (value: unknown): void => {
    const token = toNormalizedToken(value);
    if (token) {
      tokenSet.add(token);
    }
  };

  addToken(message.content);

  toSearchableAttachments(message.attachments).forEach((attachment) => {
    const fileName = typeof attachment.fileName === "string" ? attachment.fileName : "";
    const contentType = typeof attachment.contentType === "string" ? attachment.contentType : "";
    const kind = typeof attachment.kind === "string" ? attachment.kind : "";
    const url = typeof attachment.url === "string" ? attachment.url : "";

    addToken(fileName);
    addToken(contentType);
    addToken(kind);
    addToken(url);

    const voiceMetadata = getVoiceNoteAttachmentMetadata({
      kind,
      fileName,
      contentType,
    });
    buildVoiceNoteSearchTokens(voiceMetadata).forEach((token) => addToken(token));
  });

  return Array.from(tokenSet).join(" ");
};

