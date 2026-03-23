type VoiceNoteAttachmentCandidate = Readonly<{
  kind?: string | null;
  fileName?: string | null;
  contentType?: string | null;
}>;

export type VoiceNoteAttachmentMetadata = Readonly<{
  isVoiceNote: boolean;
  recordedAtUnixMs: number | null;
  durationSeconds: number | null;
  durationLabel: string | null;
}>;

const VOICE_NOTE_FILENAME_PATTERN = /^voice-note-(\d{13})(?:-d(\d{1,6}))?\.[a-z0-9]+$/i;
const VOICE_NOTE_FILENAME_PREFIX = "voice-note-";

const toNonNegativeFiniteNumberOrNull = (value: unknown): number | null => (
  typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null
);

export const formatVoiceNoteDurationLabel = (durationSecondsInput: number): string => {
  const durationSeconds = Math.floor(durationSecondsInput);
  if (!Number.isFinite(durationSeconds) || durationSeconds < 0) {
    return "0:00";
  }
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

export const formatVoiceNoteRecordedAtLabel = (recordedAtUnixMsInput: number): string | null => {
  const recordedAtUnixMs = Math.floor(recordedAtUnixMsInput);
  if (!Number.isFinite(recordedAtUnixMs) || recordedAtUnixMs <= 0) {
    return null;
  }
  const recordedAtDate = new Date(recordedAtUnixMs);
  if (Number.isNaN(recordedAtDate.getTime())) {
    return null;
  }
  const dateLabel = recordedAtDate.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const timeLabel = recordedAtDate.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${dateLabel} ${timeLabel}`;
};

export const parseVoiceNoteFileName = (fileNameInput: string): VoiceNoteAttachmentMetadata => {
  const fileName = fileNameInput.trim().toLowerCase();
  if (fileName.length === 0 || !fileName.startsWith(VOICE_NOTE_FILENAME_PREFIX)) {
    return {
      isVoiceNote: false,
      recordedAtUnixMs: null,
      durationSeconds: null,
      durationLabel: null,
    };
  }

  const strictMatch = fileName.match(VOICE_NOTE_FILENAME_PATTERN);
  if (!strictMatch) {
    return {
      isVoiceNote: true,
      recordedAtUnixMs: null,
      durationSeconds: null,
      durationLabel: null,
    };
  }

  const recordedAtUnixMs = toNonNegativeFiniteNumberOrNull(Number(strictMatch[1]));
  const durationSeconds = strictMatch[2]
    ? toNonNegativeFiniteNumberOrNull(Number(strictMatch[2]))
    : null;

  return {
    isVoiceNote: true,
    recordedAtUnixMs,
    durationSeconds,
    durationLabel: typeof durationSeconds === "number"
      ? formatVoiceNoteDurationLabel(durationSeconds)
      : null,
  };
};

export const getVoiceNoteAttachmentMetadata = (
  attachment: VoiceNoteAttachmentCandidate,
): VoiceNoteAttachmentMetadata => {
  const kind = typeof attachment.kind === "string" ? attachment.kind.trim().toLowerCase() : "";
  const fileName = typeof attachment.fileName === "string" ? attachment.fileName : "";
  const parsedByFileName = parseVoiceNoteFileName(fileName);
  if (parsedByFileName.isVoiceNote) {
    return parsedByFileName;
  }
  if (kind === "voice_note") {
    return {
      isVoiceNote: true,
      recordedAtUnixMs: null,
      durationSeconds: null,
      durationLabel: null,
    };
  }

  return {
    isVoiceNote: false,
    recordedAtUnixMs: null,
    durationSeconds: null,
    durationLabel: null,
  };
};

export const buildVoiceNoteSearchTokens = (
  metadata: VoiceNoteAttachmentMetadata,
): ReadonlyArray<string> => {
  if (!metadata.isVoiceNote) {
    return [];
  }
  const tokens = new Set<string>(["voice", "voice note", "audio note"]);
  if (typeof metadata.durationSeconds === "number") {
    tokens.add(`duration ${metadata.durationSeconds}s`);
    tokens.add(`duration ${metadata.durationSeconds} sec`);
    if (metadata.durationLabel) {
      tokens.add(metadata.durationLabel);
    }
  }
  if (typeof metadata.recordedAtUnixMs === "number") {
    tokens.add(`${metadata.recordedAtUnixMs}`);
  }
  return Array.from(tokens);
};
