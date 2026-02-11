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
  kind: 'image' | 'video' | 'audio';
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
  createdAt: Date;
  retryCount: number;
  nextRetryAt: Date;
  signedEvent?: NostrEvent;
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
}

const MAX_MESSAGES_PER_CONVERSATION = 5000; // Increased due to IndexedDB
const MAX_RETRY_ATTEMPTS = 5;

/**
 * Per-identity message queue implementation with encryption at rest using IndexedDB
 * Requirement 1.2: Persistent local storage with encryption
 */
export class MessageQueue implements IMessageQueue {
  private identityPubkey: PublicKeyHex;
  private db: IDBDatabase | null = null;
  private encryptionKeyMaterial: string;

  constructor(identityPubkey: PublicKeyHex, encryptionSecret?: string) {
    this.identityPubkey = identityPubkey;
    // Fallback to pubkey if no secret, but in Phase 7 we'll pass a real secret
    this.encryptionKeyMaterial = encryptionSecret || identityPubkey;
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
          console.error("Failed to decrypt stored message:", e);
          // Return the stored object as is, maybe the content is lost if it was encrypted
          resolve({
            ...stored,
            timestamp: new Date(stored.timestamp)
          });
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
                console.error("Failed to decrypt message in list:", e);
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
            };
          }));
          resolve(processedResults);
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
      nextRetryAt: message.nextRetryAt.getTime()
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction("queue", "readwrite");
      tx.objectStore("queue").put(stored);
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
        resolve(results.filter(m => m.nextRetryAt <= now && m.retryCount < MAX_RETRY_ATTEMPTS).map(m => ({
          ...m,
          createdAt: new Date(m.createdAt),
          nextRetryAt: new Date(m.nextRetryAt)
        })));
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
