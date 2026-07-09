export type LocalMediaIndexEntry = Readonly<{
  remoteUrl: string;
  relativePath: string;
  savedAtUnixMs: number;
  fileName: string;
  contentType: string;
  size: number;
  messageEventId?: string;
  explicitChatSave?: boolean;
}>;

export type LocalMediaIndex = Record<string, LocalMediaIndexEntry>;
