import { openMessageDb } from "./open-message-db";
import type { NostrEvent } from "@dweb/nostr/nostr-event";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { PrivacySettingsService } from "../../settings/services/privacy-settings-service";

/**
 * Enhanced message model with Nostr integration
 */
export interface Message {
  id: string;
  conversationId: string;
  content: string;
  kind: 'user' | 'command';
  timestamp: Date;
  isOutgoing: boolean;
  status: MessageStatus;

  dmFormat?: 'nip17' | 'nip04';

  // Nostr-specific fields
  eventId?: string;
  eventCreatedAt?: Date;
  senderPubkey: PublicKeyHex;
  recipientPubkey: PublicKeyHex;

  // Metadata
  encryptedContent?: string;
  relayResults?: RelayResult[];
  syncedAt?: Date;
  retryCount?: number;

  // Optional features
  attachments?: Attachment[];
  replyTo?: ReplyTo;
  reactions?: ReactionsByEmoji;
  deletedAt?: Date;

  // Storage specific (internal)
  encryptedData?: string;
}

/**
 * Message status enumeration
 */
export type MessageStatus =
  | 'sending'      // Being sent to relays
  | 'queued'       // Queued for retry
  | 'accepted'     // Accepted by at least one relay
  | 'rejected'     // Rejected by all relays
  | 'delivered'    // Confirmed delivered to recipient
  | 'failed';      // Permanently failed

export interface RelayResult {
  relayUrl: string;
  success: boolean;
  error?: string;
  latency?: number;
}

export interface Attachment {
  kind: 'image' | 'video' | 'audio' | 'voice_note' | 'file';
  url: string;
  contentType: string;
  fileName: string;
}

export interface ReplyTo {
  messageId: string;
  previewText: string;
}

export type ReactionsByEmoji = Readonly<Record<string, number>>;

/**
 * Outgoing message in retry queue
 */
export interface OutgoingMessage {
  id: string;
  conversationId: string;
  content: string;
  recipientPubkey: PublicKeyHex;
  targetRelayUrls?: string[];
  achievedRelayUrls?: string[];
  createdAt: Date;
  retryCount: number;
  nextRetryAt: Date;
  lastReasonCode?: string;
  signedEvent?: NostrEvent;
  ownerPubkey?: PublicKeyHex;
}

export interface PaginationOptions {
  limit?: number;
  offset?: number;
  before?: Date;
  after?: Date;
}

export interface StorageStats {
  totalMessages: number;
  totalSizeBytes: number;
  oldestMessage?: Date;
  newestMessage?: Date;
}

export interface IMessageQueue {
  persistMessage(message: Message): Promise<void>;
  updateMessageStatus(messageId: string, status: MessageStatus): Promise<void>;
  getMessage(messageId: string): Promise<Message | null>;
  getMessages(conversationId: string, options?: PaginationOptions): Promise<Message[]>;
  queueOutgoingMessage(message: OutgoingMessage): Promise<void>;
  getQueuedMessages(): Promise<OutgoingMessage[]>;
  removeFromQueue(messageId: string): Promise<void>;
  getLastMessageTimestamp(conversationId: string): Promise<Date | null>;
  markMessagesSynced(messageIds: string[]): Promise<void>;
  cleanupOldMessages(olderThan: Date): Promise<void>;
  getStorageUsage(): Promise<StorageStats>;
  /**
   * Get recent messages across all conversations for initialization
   */
  getAllMessages(limit?: number): Promise<Message[]>;

}

const MAX_MESSAGES_PER_CONVERSATION = 5000; // Increased due to IndexedDB
export const MAX_OUTGOING_QUEUE_RETRY_ATTEMPTS = 5;

/**
 * Per-identity message queue implementation with encryption at rest using IndexedDB
 * Requirement 1.2: Persistent local storage with encryption
 */
export class MessageQueue implements IMessageQueue {
  private identityPubkey: PublicKeyHex;
  private db: IDBDatabase | null = null;
  private encryptionKeyMaterial: string;
  private decryptFailures: Set<string> = new Set();
  private queueSanitizationWarnings: Set<string> = new Set();

  constructor(identityPubkey: PublicKeyHex) {
    this.identityPubkey = identityPubkey;
    // Standardize on pubkey for consistent encryption material across sessions
    this.encryptionKeyMaterial = identityPubkey;
  }

  private async getDb(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    this.db = await openMessageDb();
    return this.db;
  }

  /**
   * Derive AES key from secret
   */
  private async getCryptoKey(): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const data = encoder.encode(this.encryptionKeyMaterial);
    const hash = await crypto.subtle.digest('SHA-256', data);

    return await crypto.subtle.importKey(
      'raw',
      hash,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypt sensitive data
   */
  private async encryptData(plaintext: string): Promise<string> {
    const cryptoKey = await this.getCryptoKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const encoded = encoder.encode(plaintext);

    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      encoded
    );

    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.length);

    return btoa(String.fromCharCode(...combined));
  }

  /**
   * Decrypt sensitive data
   */
  private async decryptData(base64Data: string): Promise<string> {
    const cryptoKey = await this.getCryptoKey();
    const combined = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      ciphertext
    );

    return new TextDecoder().decode(decrypted);
  }

  private warnDecryptOnce(messageId: string, error: unknown, scope: "single" | "list" | "global"): void {
    // Determine key by scope to prevent flooding the console. One warning per type is enough.
    const key = scope;
    if (this.decryptFailures.has(key)) {
      return;
    }
    this.decryptFailures.add(key);
    // Use warn instead of error to avoid triggering Next.js error tracking overlays
    console.warn(
      scope === "global"
        ? `Failed to decrypt a message in global list (e.g., ID: ${messageId}). This is expected for messages encrypted with an older/different key.`
        : scope === "list"
          ? `Failed to decrypt a message in list (e.g., ID: ${messageId}). This is expected for messages encrypted with an older/different key.`
          : `Failed to decrypt stored message (ID: ${messageId}). This is expected for messages encrypted with an older/different key.`,
      error
    );
  }

  private isOwnedConversationId(conversationId: unknown): boolean {
    if (typeof conversationId !== "string") {
      return false;
    }
    return conversationId.split(":").includes(this.identityPubkey);
  }

  private isOwnedMessageRecord(stored: Record<string, unknown> | null | undefined): boolean {
    if (!stored || typeof stored !== "object") {
      return false;
    }
    if (typeof stored.ownerPubkey === "string") {
      return stored.ownerPubkey === this.identityPubkey;
    }
    return stored.senderPubkey === this.identityPubkey
      || stored.recipientPubkey === this.identityPubkey
      || this.isOwnedConversationId(stored.conversationId);
  }

  private isOwnedQueuedRecord(stored: Record<string, unknown> | null | undefined): boolean {
    if (!stored || typeof stored !== "object") {
      return false;
    }
    if (typeof stored.ownerPubkey === "string") {
      return stored.ownerPubkey === this.identityPubkey;
    }
    const signedEvent = stored.signedEvent;
    if (signedEvent && typeof signedEvent === "object" && typeof (signedEvent as Record<string, unknown>).pubkey === "string") {
      return (signedEvent as Record<string, unknown>).pubkey === this.identityPubkey;
    }
    return stored.senderPubkey === this.identityPubkey;
  }

  async persistMessage(message: Message): Promise<void> {
    const db = await this.getDb();
    const settings = PrivacySettingsService.getSettings();
    const shouldEncrypt = settings.encryptStorageAtRest;

    // Pick fields to protect
    const sensitive = {
      content: message.content,
      encryptedContent: message.encryptedContent,
      attachments: message.attachments,
      replyTo: message.replyTo
    };

    let encryptedData: string | undefined;
    let storedContent = message.content;
    let storedEncryptedContent = message.encryptedContent;
    let storedAttachments = message.attachments;
    let storedReplyTo = message.replyTo;

    if (shouldEncrypt) {
      encryptedData = await this.encryptData(JSON.stringify(sensitive));
      storedContent = "[ENCRYPTED]";
      storedEncryptedContent = undefined;
      storedAttachments = undefined;
      storedReplyTo = undefined;
    }

    // Message object for storage
    const storedObject = {
      ...message,
      content: storedContent,
      encryptedContent: storedEncryptedContent,
      attachments: storedAttachments,
      replyTo: storedReplyTo,
      encryptedData,
      isEncrypted: shouldEncrypt,
      // For IndexedDB sorting/filtering
      timestamp: message.timestamp.getTime(),
      ownerPubkey: this.identityPubkey // Isolate within shared DB
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction("messages", "readwrite");
      const store = tx.objectStore("messages");
      const request = store.put(storedObject);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async updateMessageStatus(messageId: string, status: MessageStatus): Promise<void> {
    const message = await this.getMessage(messageId);
    if (!message) return;

    message.status = status;
    return this.persistMessage(message);
  }

  async getMessage(messageId: string): Promise<Message | null> {
    const db = await this.getDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction("messages", "readonly");
      const store = tx.objectStore("messages");
      const request = store.get(messageId);

      request.onsuccess = async () => {
      const stored = request.result;
      if (!stored) return resolve(null);
      if (!this.isOwnedMessageRecord(stored as Record<string, unknown>)) return resolve(null);

      // Decrypt if it was stored encrypted
        try {
          let messageData = { ...stored };

          if (stored.isEncrypted && stored.encryptedData) {
            const decryptedJson = await this.decryptData(stored.encryptedData);
            const decrypted = JSON.parse(decryptedJson);
            messageData = { ...messageData, ...decrypted };
          }

          // Migrate legacy attachment to attachments
          if ((messageData as any).attachment && !messageData.attachments) {
            messageData.attachments = [(messageData as any).attachment];
            delete (messageData as any).attachment;
          }

          resolve({
            ...messageData,
            timestamp: new Date(stored.timestamp),
            eventCreatedAt: stored.eventCreatedAt ? new Date(stored.eventCreatedAt) : undefined
          });
        } catch (e) {
          this.warnDecryptOnce(String(messageId), e, "single");
          // Return null so the caller can handle it as missing and potentially re-fetch
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getMessages(conversationId: string, options: PaginationOptions = {}): Promise<Message[]> {
    const db = await this.getDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction("messages", "readonly");
      const store = tx.objectStore("messages");
      const index = store.index("conversationId");
      const request = index.getAll(conversationId);

      request.onsuccess = async () => {
        let results = request.result as any[];
        results = results.filter((stored) => this.isOwnedMessageRecord(stored));

        // Sort newest first
        results.sort((a, b) => b.timestamp - a.timestamp);

        const offset = options.offset || 0;
        const limit = options.limit || results.length;
        results = results.slice(offset, offset + limit);

        try {
          const processedResults = await Promise.all(results.map(async (stored) => {
            let messageData = { ...stored };

            if (stored.isEncrypted && stored.encryptedData) {
              try {
                const decryptedJson = await this.decryptData(stored.encryptedData);
                const decrypted = JSON.parse(decryptedJson);
                messageData = { ...messageData, ...decrypted };
              } catch (e) {
                this.warnDecryptOnce(String(stored.id ?? stored.eventId ?? stored.timestamp ?? "unknown"), e, "list");
                // Drop the message so it can be cleanly re-fetched from relays
                return null;
              }
            }

            // Migrate legacy attachment to attachments
            if ((messageData as any).attachment && !messageData.attachments) {
              messageData.attachments = [(messageData as any).attachment];
              delete (messageData as any).attachment;
            }

            return {
              ...messageData,
              timestamp: new Date(stored.timestamp)
            } as Message;
          }));
          resolve(processedResults.filter((m): m is Message => m !== null));
        } catch (e) {
          reject(e);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async queueOutgoingMessage(message: OutgoingMessage): Promise<void> {
    const db = await this.getDb();
    const stored = {
      ...message,
      createdAt: message.createdAt.getTime(),
      nextRetryAt: message.nextRetryAt.getTime(),
      ownerPubkey: message.ownerPubkey ?? this.identityPubkey,
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction("queue", "readwrite");
      tx.objectStore("queue").put(stored);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  private hasValidSignedEvent(value: unknown): value is NostrEvent {
    if (!value || typeof value !== "object") {
      return false;
    }
    const candidate = value as Record<string, unknown>;
    return typeof candidate.id === "string"
      && candidate.id.length > 0
      && typeof candidate.pubkey === "string"
      && candidate.pubkey.length > 0
      && typeof candidate.sig === "string"
      && candidate.sig.length > 0;
  }

  private async purgeInvalidQueuedEntries(messageIds: ReadonlyArray<string>): Promise<void> {
    if (messageIds.length === 0) {
      return;
    }
    const db = await this.getDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("queue", "readwrite");
      const queueStore = tx.objectStore("queue");
      messageIds.forEach((messageId) => {
        queueStore.delete(messageId);
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getQueuedMessages(): Promise<OutgoingMessage[]> {
    const db = await this.getDb();
    const now = Date.now();

    return new Promise((resolve, reject) => {
      const tx = db.transaction("queue", "readonly");
      const store = tx.objectStore("queue");
      const request = store.getAll();

      request.onsuccess = () => {
        const results = request.result as any[];
        const invalidEntryIds: Array<string> = [];
        const queuedMessages = results
          .filter((stored) => this.isOwnedQueuedRecord(stored))
          .filter((stored) => {
            const isValidSignedEvent = this.hasValidSignedEvent(stored.signedEvent);
            if (!isValidSignedEvent) {
              if (typeof stored.id === "string" && stored.id.length > 0) {
                invalidEntryIds.push(stored.id);
              }
              return false;
            }
            return true;
          })
          .filter((stored) => stored.nextRetryAt <= now && stored.retryCount < MAX_OUTGOING_QUEUE_RETRY_ATTEMPTS)
          .map((stored) => ({
            ...stored,
            createdAt: new Date(stored.createdAt),
            nextRetryAt: new Date(stored.nextRetryAt),
          }));

        if (invalidEntryIds.length > 0) {
          const warningKey = `invalid-queue-entry:${this.identityPubkey}`;
          if (!this.queueSanitizationWarnings.has(warningKey)) {
            this.queueSanitizationWarnings.add(warningKey);
            console.warn(
              `[MessageQueue] Purging ${invalidEntryIds.length} queued entries missing signed events for ${this.identityPubkey.slice(0, 12)}...`
            );
          }
          void this.purgeInvalidQueuedEntries(Array.from(new Set(invalidEntryIds))).catch((error) => {
            console.warn("[MessageQueue] Failed to purge invalid queued entries", error);
          });
        }

        resolve(queuedMessages);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async removeFromQueue(messageId: string): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("queue", "readwrite");
      tx.objectStore("queue").delete(messageId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAllMessages(limit: number = 2000): Promise<Message[]> {
    const db = await this.getDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction("messages", "readonly");
      const store = tx.objectStore("messages");
      const request = store.getAll();

      request.onsuccess = async () => {
        let results = request.result as any[];
        results = results.filter((stored) => this.isOwnedMessageRecord(stored));

        // Sort newest first
        results.sort((a, b) => b.timestamp - a.timestamp);

        if (limit && results.length > limit) {
          results = results.slice(0, limit);
        }

        try {
          const processedResults = await Promise.all(results.map(async (stored) => {
            let messageData = { ...stored };

            if (stored.isEncrypted && stored.encryptedData) {
              try {
                const decryptedJson = await this.decryptData(stored.encryptedData);
                const decrypted = JSON.parse(decryptedJson);
                messageData = { ...messageData, ...decrypted };
              } catch (e) {
                this.warnDecryptOnce(String(stored.id ?? stored.eventId ?? stored.timestamp ?? "unknown"), e, "global");
                // Drop the message so it can be cleanly re-fetched from relays
                return null;
              }
            }

            // Migrate legacy attachment
            if ((messageData as any).attachment && !messageData.attachments) {
              messageData.attachments = [(messageData as any).attachment];
              delete (messageData as any).attachment;
            }

            return {
              ...messageData,
              timestamp: new Date(stored.timestamp),
              eventCreatedAt: stored.eventCreatedAt ? new Date(stored.eventCreatedAt) : undefined
            } as Message;
          }));
          resolve(processedResults.filter((m): m is Message => m !== null));
        } catch (e) {
          reject(e);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }


  async getLastMessageTimestamp(conversationId: string): Promise<Date | null> {
    const messages = await this.getMessages(conversationId, { limit: 1 });
    return messages.length > 0 ? messages[0].timestamp : null;
  }

  async markMessagesSynced(messageIds: string[]): Promise<void> {
    for (const id of messageIds) {
      const msg = await this.getMessage(id);
      if (msg) {
        msg.syncedAt = new Date();
        await this.persistMessage(msg);
      }
    }
  }

  async cleanupOldMessages(olderThan: Date): Promise<void> {
    // Implementation for IndexedDB deletion would go here
  }

  async getStorageUsage(): Promise<StorageStats> {
    return { totalMessages: 0, totalSizeBytes: 0 };
  }
}
