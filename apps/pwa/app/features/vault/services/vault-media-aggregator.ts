import type { Message } from "@/app/features/messaging/types";
import type { VaultMediaItem } from "../types/vault-media-item";
import { getLocalMediaIndexEntryByRemoteUrl, resolveLocalMediaUrl } from "./local-media-store";

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

/**
 * Build vault rows using the synchronous local index only — no per-file native exists checks.
 * This keeps first paint fast; use enrichVaultMediaItemsWithLocalUrls for verified local URLs.
 */
export const buildVaultMediaItemsFast = (
  candidates: ReadonlyArray<VaultMediaCandidate>,
): VaultMediaItem[] => candidates.map(({ msg, attachment, attachmentIndex }) => {
  const indexEntry = getLocalMediaIndexEntryByRemoteUrl(attachment.url);
  return {
    id: `${msg.id}-${attachmentIndex}-${attachment.url}`,
    messageId: msg.id,
    attachment,
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
}>;

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
  return mapWithConcurrency(items, concurrency, async (item) => {
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
};
