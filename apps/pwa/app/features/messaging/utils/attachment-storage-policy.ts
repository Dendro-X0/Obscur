import type { Attachment } from "../types";
import { getVoiceNoteAttachmentMetadata } from "@/app/features/messaging/services/voice-note-metadata";

type AttachmentStorageCandidate = Readonly<Pick<Attachment, "kind" | "fileName" | "contentType">>;

export const isVoiceNoteAttachment = (attachment: AttachmentStorageCandidate): boolean => {
  if (attachment.kind === "voice_note") {
    return true;
  }
  return getVoiceNoteAttachmentMetadata(attachment).isVoiceNote;
};

export const shouldCacheAttachmentInVault = (attachment: AttachmentStorageCandidate): boolean => (
  !isVoiceNoteAttachment(attachment)
);
