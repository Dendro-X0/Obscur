import type { Message } from "@/app/features/messaging/types";
import type { VaultMediaItem } from "../types/vault-media-item";
import {
  getLocalMediaIndexEntryByRemoteUrl,
  getLocalMediaIndexSnapshot,
  isLocalVaultOnlyUrl,
  resolveLocalMediaUrl,
  resolveVaultDisplayFileName,
} from "./local-media-store";
import { isVaultStandaloneCatalogUrl } from "./vault-disk-inventory";
import { getMediaKindForPolicy } from "@/app/features/messaging/lib/media-upload-policy";

export type VaultMediaCandidate = Readonly<{
  msg: Message;
  attachment: NonNullable<Message["attachments"]>[number];
  attachmentIndex: number;
}>;

const isVaultAttachmentKind = (
  kind: string,
): kind is "image" | "video" | "audio" | "file" => (
  kind === "image" || kind === "video" || kind === "audio" || kind === "file"
);

export const collectVaultMediaCandidates = (
  messages: ReadonlyArray<Message>,
): ReadonlyArray<VaultMediaCandidate> => {
  const candidates: VaultMediaCandidate[] = [];
  for (const msg of messages) {
    const attachments = msg.attachments;
    if (!attachments || attachments.length === 0) {
      continue;
    }
    attachments.forEach((attachment, attachmentIndex) => {
      if (!isVaultAttachmentKind(attachment.kind)) {
        return;
      }
      candidates.push({ msg, attachment, attachmentIndex });
    });
  }
  return candidates;
};

const inferKindFromIndexEntry = (fileName: string, contentType: string): VaultMediaItem["attachment"]["kind"] => {
  const fakeFile = new File([], fileName, { type: contentType });
  const kind = getMediaKindForPolicy(fakeFile);
  if (kind === "voice_note") {
    return "audio";
  }
  return kind;
};

/**
 * Standalone vault rows when an attachment is locally cached but not present in
 * the current chat-media scan:
 * - local-only vault uploads (`obscur://vault/local/...`)
 * - explicit chat saves recorded in local index (`messageEventId` or `explicitChatSave`)
 */
export const buildStandaloneLocalVaultMediaItems = (
  existingRemoteUrls: ReadonlySet<string>,
): VaultMediaItem[] => {
  const index = getLocalMediaIndexSnapshot();
  const items: VaultMediaItem[] = [];
  Object.entries(index).forEach(([remoteUrl, entry]) => {
    const isStandaloneVaultItem = isVaultStandaloneCatalogUrl(remoteUrl);
    const isExplicitChatSave = (
      (typeof entry?.messageEventId === "string" && entry.messageEventId.trim().length > 0)
      || entry?.explicitChatSave === true
    );
    if (!isStandaloneVaultItem && !isExplicitChatSave) {
      return;
    }
    if (existingRemoteUrls.has(remoteUrl)) {
      return;
    }
    if (!entry?.relativePath?.trim()) {
      return;
    }
    items.push({
      id: `local-vault-${remoteUrl}`,
      messageId: `local-vault:${remoteUrl}`,
      attachment: {
        kind: inferKindFromIndexEntry(entry.fileName, entry.contentType),
        url: remoteUrl,
        contentType: entry.contentType || "application/octet-stream",
        fileName: resolveVaultDisplayFileName({
          indexFileName: entry.fileName,
          relativePath: entry.relativePath,
        }),
      },
      timestamp: new Date(entry.savedAtUnixMs),
      remoteUrl,
      isLocalCached: true,
      localRelativePath: entry.relativePath,
      sourceConversationId: null,
    });
  });
  return items;
};

/**
 * Build vault rows using the synchronous local index only — no per-file native exists checks.
 * This keeps first paint fast; use enrichVaultMediaItemsWithLocalUrls for verified local URLs.
 */
export const buildVaultMediaItemsFast = (
  candidates: ReadonlyArray<VaultMediaCandidate>,
): VaultMediaItem[] => candidates.map(({ msg, attachment, attachmentIndex }) => {
  const indexEntry = getLocalMediaIndexEntryByRemoteUrl(attachment.url);
  const displayFileName = resolveVaultDisplayFileName({
    attachmentFileName: attachment.fileName,
    indexFileName: indexEntry?.fileName,
    relativePath: indexEntry?.relativePath,
  });
  return {
    id: `${msg.id}-${attachmentIndex}-${attachment.url}`,
    messageId: msg.id,
    attachment: displayFileName === attachment.fileName
      ? attachment
      : { ...attachment, fileName: displayFileName },
    timestamp: msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp),
    remoteUrl: attachment.url,
    isLocalCached: Boolean(indexEntry),
    localRelativePath: indexEntry?.relativePath ?? null,
    sourceConversationId: typeof msg.conversationId === "string" && msg.conversationId.trim().length > 0
      ? msg.conversationId
      : null,
  } as VaultMediaItem;
});

export const sortVaultMediaItemsNewestFirst = (
  items: ReadonlyArray<VaultMediaItem>,
): VaultMediaItem[] => (
  [...items].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
);

export type EnrichVaultMediaLocalUrlsOptions = Readonly<{
  concurrency?: number;
  /** Only enrich items in `[offset, offset + limit)`; other rows are returned unchanged. */
  offset?: number;
  limit?: number;
}>;

export const VAULT_INITIAL_ENRICH_LIMIT = 48;

const mapWithConcurrency = async <T, R>(
  items: ReadonlyArray<T>,
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> => {
  if (items.length === 0) {
    return [];
  }
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const current = nextIndex;
      nextIndex += 1;
      results[current] = await mapper(items[current]!, current);
    }
  });
  await Promise.all(workers);
  return results;
};

/**
 * Optionally resolves local file:// URLs for cached items. Runs with bounded concurrency
 * so Tauri fileExists does not block the UI thread for seconds on large vaults.
 */
export const enrichVaultMediaItemsWithLocalUrls = async (
  items: ReadonlyArray<VaultMediaItem>,
  options: EnrichVaultMediaLocalUrlsOptions = {},
): Promise<VaultMediaItem[]> => {
  const concurrency = options.concurrency ?? 4;
  const offset = Math.max(0, options.offset ?? 0);
  const limit = options.limit ?? Math.max(0, items.length - offset);
  if (limit <= 0 || offset >= items.length) {
    return [...items];
  }

  const end = Math.min(items.length, offset + limit);
  const slice = items.slice(offset, end);
  const enrichedSlice = await mapWithConcurrency(slice, concurrency, async (item) => {
    if (!item.isLocalCached) {
      return item;
    }
    const localUrl = await resolveLocalMediaUrl(item.remoteUrl);
    if (!localUrl) {
      return { ...item, isLocalCached: false, localRelativePath: null };
    }
    return {
      ...item,
      isLocalCached: true,
      attachment: { ...item.attachment, url: localUrl },
    };
  });

  const result = [...items];
  for (let index = 0; index < enrichedSlice.length; index += 1) {
    result[offset + index] = enrichedSlice[index]!;
  }
  return result;
};
