"use client";

/**
 * CAS Media Recovery Service
 *
 * Restores missing media blobs from Content-Addressed Storage (CAS) after account restore.
 *
 * Problem: Account backup includes message metadata with attachment URLs (CAS hashes), but not
 * the actual blob data (which is too large for Nostr events). On fresh-device restore, messages
 * exist but media appears "missing" because vault blobs weren't transferred.
 *
 * Solution: After restore completes, scan for orphaned media references and fetch from CAS.
 */

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { chatStateStoreService } from "@/app/features/messaging/services/chat-state-store";
import { getActiveProfileIdSafe } from "@/app/features/profiles/services/profile-scope";
import { logAppEvent } from "@/app/shared/log-app-event";

export type MediaRecoveryStatus =
  | "idle"
  | "scanning"
  | "fetching"
  | "complete"
  | "error";

type MutableMediaRecoveryResult = {
  status: MediaRecoveryStatus;
  scannedMessages: number;
  orphanedReferences: number;
  fetchedBlobs: number;
  failedBlobs: number;
  errors: string[];
};

export type MediaRecoveryResult = Readonly<MutableMediaRecoveryResult>;

const CAS_GATEWAY_URL = "https://cas.obscur.app";

const fetchBlobFromCAS = async (contentHash: string): Promise<Blob | null> => {
  try {
    const response = await fetch(`${CAS_GATEWAY_URL}/blob/${contentHash}`, {
      method: "GET",
      headers: {
        Accept: "application/octet-stream, */*",
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`CAS fetch failed: ${response.status} ${response.statusText}`);
    }

    return await response.blob();
  } catch (error) {
    console.error(`Failed to fetch blob ${contentHash.slice(0, 16)}... from CAS:`, error);
    return null;
  }
};

const getVaultStore = async (): Promise<IDBDatabase | null> => {
  return new Promise((resolve) => {
    const profileId = getActiveProfileIdSafe();
    const dbName = `obscur-vault-${profileId}`;
    const request = indexedDB.open(dbName);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      console.error("Failed to open vault IndexedDB");
      resolve(null);
    };
    request.onblocked = () => {
      console.error("Vault IndexedDB blocked");
      resolve(null);
    };
  });
};

const checkBlobExistsInVault = async (contentHash: string): Promise<boolean> => {
  const db = await getVaultStore();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const transaction = db.transaction(["blobs"], "readonly");
      const store = transaction.objectStore("blobs");
      const request = store.get(contentHash);

      request.onsuccess = () => resolve(request.result !== undefined);
      request.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
};

const saveBlobToVault = async (contentHash: string, blob: Blob): Promise<boolean> => {
  const db = await getVaultStore();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const transaction = db.transaction(["blobs"], "readwrite");
      const store = transaction.objectStore("blobs");
      const request = store.put(blob, contentHash);

      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
};

interface MessageWithAttachment {
  messageId: string;
  conversationId: string;
  contentHash: string;
  contentType: string;
}

/**
 * Extract content hash from CAS URL
 * URLs are in format: https://cas.obscur.app/blob/{hash}
 */
const extractContentHash = (url: string): string | null => {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/blob\/([a-f0-9]{64})/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
};

const findMessagesWithAttachments = (publicKeyHex: PublicKeyHex): MessageWithAttachment[] => {
  const chatState = chatStateStoreService.load(publicKeyHex);
  if (!chatState) return [];

  const messages: MessageWithAttachment[] = [];

  for (const [conversationId, conversationMessages] of Object.entries(chatState.messagesByConversationId)) {
    for (const message of conversationMessages) {
      if (message.attachments && message.attachments.length > 0) {
        for (const attachment of message.attachments) {
          const contentHash = extractContentHash(attachment.url);
          if (contentHash) {
            messages.push({
              messageId: message.id,
              conversationId,
              contentHash,
              contentType: attachment.contentType,
            });
          }
        }
      }
    }
  }

  return messages;
};

/**
 * Recover missing media blobs from CAS after account restore
 */
export const recoverMissingMediaFromCAS = async (
  publicKeyHex: PublicKeyHex,
  options?: Readonly<{
    onProgress?: (progress: MediaRecoveryResult) => void;
    maxConcurrentFetches?: number;
  }>,
): Promise<MediaRecoveryResult> => {
  const result: MutableMediaRecoveryResult = {
    status: "scanning",
    scannedMessages: 0,
    orphanedReferences: 0,
    fetchedBlobs: 0,
    failedBlobs: 0,
    errors: [],
  };

  const updateProgress = () => {
    options?.onProgress?.({ ...result });
  };

  try {
    // Step 1: Find all messages with attachments
    const messagesWithAttachments = findMessagesWithAttachments(publicKeyHex);
    result.scannedMessages = messagesWithAttachments.length;
    updateProgress();

    // Step 2: Check which attachments are missing from vault
    const orphaned: MessageWithAttachment[] = [];
    for (const message of messagesWithAttachments) {
      const exists = await checkBlobExistsInVault(message.contentHash);
      if (!exists) {
        orphaned.push(message);
      }
    }
    result.orphanedReferences = orphaned.length;
    result.status = orphaned.length > 0 ? "fetching" : "complete";
    updateProgress();

    if (orphaned.length === 0) {
      return result;
    }

    // Step 3: Fetch missing blobs from CAS
    const maxConcurrent = options?.maxConcurrentFetches ?? 3;
    const queue = [...orphaned];
    const inProgress = new Set<Promise<void>>();

    const processNext = async (): Promise<void> => {
      const message = queue.shift();
      if (!message) return;

      const blob = await fetchBlobFromCAS(message.contentHash);

      if (blob) {
        const saved = await saveBlobToVault(message.contentHash, blob);
        if (saved) {
          result.fetchedBlobs++;
        } else {
          result.failedBlobs++;
          result.errors.push(`Failed to save blob ${message.contentHash.slice(0, 16)} to vault`);
        }
      } else {
        result.failedBlobs++;
        result.errors.push(`Blob ${message.contentHash.slice(0, 16)} not found in CAS`);
      }

      updateProgress();
    };

    while (queue.length > 0 || inProgress.size > 0) {
      while (inProgress.size < maxConcurrent && queue.length > 0) {
        const promise = processNext().then(() => {
          inProgress.delete(promise);
        });
        inProgress.add(promise);
      }

      if (inProgress.size > 0) {
        await Promise.race(inProgress);
      }
    }

    result.status = result.failedBlobs > 0 ? "error" : "complete";

    // Log recovery results
    logAppEvent({
      name: "vault.cas_recovery_complete",
      level: result.failedBlobs > 0 ? "warn" : "info",
      scope: { feature: "vault", action: "cas_recovery" },
      context: {
        publicKeySuffix: publicKeyHex.slice(-8),
        scannedMessages: result.scannedMessages,
        orphanedReferences: result.orphanedReferences,
        fetchedBlobs: result.fetchedBlobs,
        failedBlobs: result.failedBlobs,
      },
    });

    return result;
  } catch (error) {
    result.status = "error";
    result.errors.push(`Recovery failed: ${error instanceof Error ? error.message : String(error)}`);
    return result;
  }
};

/**
 * Check if media recovery is needed (has orphaned references)
 */
export const checkMediaRecoveryNeeded = async (
  publicKeyHex: PublicKeyHex,
): Promise<boolean> => {
  const messagesWithAttachments = findMessagesWithAttachments(publicKeyHex);

  for (const message of messagesWithAttachments.slice(0, 10)) {
    const exists = await checkBlobExistsInVault(message.contentHash);
    if (!exists) {
      return true;
    }
  }

  return false;
};

/**
 * Get recovery status for display in UI
 */
export const getMediaRecoverySummary = async (
  publicKeyHex: PublicKeyHex,
): Promise<Readonly<{
  totalMessagesWithAttachments: number;
  missingBlobs: number;
  vaultBlobs: number;
}>> => {
  const messagesWithAttachments = findMessagesWithAttachments(publicKeyHex);
  let missingCount = 0;

  for (const message of messagesWithAttachments) {
    const exists = await checkBlobExistsInVault(message.contentHash);
    if (!exists) {
      missingCount++;
    }
  }

  return {
    totalMessagesWithAttachments: messagesWithAttachments.length,
    missingBlobs: missingCount,
    vaultBlobs: messagesWithAttachments.length - missingCount,
  };
};
