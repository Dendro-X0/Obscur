import type { NostrEvent } from "@dweb/nostr/nostr-event";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

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

/**
 * Enhanced message model with Nostr integration
 */
export interface Message {
  id: string;
  conversationId: string;
  content: string;
  timestamp: Date;
  isOutgoing: boolean;
  status: MessageStatus;
  
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
  attachment?: Attachment;
  replyTo?: ReplyTo;
  reactions?: ReactionsByEmoji;
  deletedAt?: Date;
}

/**
 * Relay operation result
 */
export interface RelayResult {
  relayUrl: string;
  success: boolean;
  error?: string;
  latency?: number;
}

/**
 * Attachment metadata
 */
export interface Attachment {
  kind: 'image' | 'video';
  url: string;
  contentType: string;
  fileName: string;
}

/**
 * Reply reference
 */
export interface ReplyTo {
  messageId: string;
  previewText: string;
}

/**
 * Reaction counts by emoji
 */
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

/**
 * Pagination options for message queries
 */
export interface PaginationOptions {
  limit?: number;
  offset?: number;
  before?: Date;
  after?: Date;
}

/**
 * Storage usage statistics
 */
export interface StorageStats {
  totalMessages: number;
  totalSizeBytes: number;
  oldestMessage?: Date;
  newestMessage?: Date;
}

/**
 * Message queue service interface
 */
export interface IMessageQueue {
  // Persistence
  persistMessage(message: Message): Promise<void>;
  updateMessageStatus(messageId: string, status: MessageStatus): Promise<void>;
  getMessage(messageId: string): Promise<Message | null>;
  getMessages(conversationId: string, options?: PaginationOptions): Promise<Message[]>;
  
  // Queue Management
  queueOutgoingMessage(message: OutgoingMessage): Promise<void>;
  getQueuedMessages(): Promise<OutgoingMessage[]>;
  removeFromQueue(messageId: string): Promise<void>;
  
  // Sync Support
  getLastMessageTimestamp(conversationId: string): Promise<Date | null>;
  markMessagesSynced(messageIds: string[]): Promise<void>;
  
  // Cleanup
  cleanupOldMessages(olderThan: Date): Promise<void>;
  getStorageUsage(): Promise<StorageStats>;
}

/**
 * Maximum messages per conversation to prevent storage bloat
 */
const MAX_MESSAGES_PER_CONVERSATION = 500;

/**
 * Maximum retry attempts for failed messages
 */
const MAX_RETRY_ATTEMPTS = 5;

/**
 * Per-identity message queue implementation with encryption at rest
 * Uses localStorage for simplicity and per-identity isolation
 */
export class MessageQueue implements IMessageQueue {
  private identityPubkey: PublicKeyHex;
  private storagePrefix: string;

  constructor(identityPubkey: PublicKeyHex) {
    this.identityPubkey = identityPubkey;
    this.storagePrefix = `obscur.messages.${identityPubkey}`;
  }

  /**
   * Encrypt sensitive message data for at-rest storage
   */
  private async encryptMessageData(message: Message): Promise<string> {
    try {
      // Create a deterministic encryption key from identity pubkey
      const encoder = new TextEncoder();
      const keyMaterial = encoder.encode(this.identityPubkey);
      const hashBuffer = await crypto.subtle.digest('SHA-256', keyMaterial);
      const key = new Uint8Array(hashBuffer);
      
      // Generate random IV for this message
      const iv = crypto.getRandomValues(new Uint8Array(12));
      
      // Import key for AES-GCM
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        key,
        { name: 'AES-GCM' },
        false,
        ['encrypt']
      );
      
      // Serialize message data
      const messageData = JSON.stringify({
        content: message.content,
        encryptedContent: message.encryptedContent,
        attachment: message.attachment,
        replyTo: message.replyTo,
        reactions: message.reactions
      });
      
      const dataBytes = encoder.encode(messageData);
      
      // Encrypt
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        dataBytes
      );
      
      // Combine IV and encrypted data
      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv, 0);
      combined.set(new Uint8Array(encrypted), iv.length);
      
      // Convert to base64
      return btoa(String.fromCharCode(...combined));
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error(`Message encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Decrypt message data from storage
   */
  private async decryptMessageData(encryptedData: string): Promise<any> {
    try {
      // Create the same encryption key from identity pubkey
      const encoder = new TextEncoder();
      const keyMaterial = encoder.encode(this.identityPubkey);
      const hashBuffer = await crypto.subtle.digest('SHA-256', keyMaterial);
      const key = new Uint8Array(hashBuffer);
      
      // Decode base64
      const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
      
      // Extract IV and encrypted data
      const iv = combined.slice(0, 12);
      const encrypted = combined.slice(12);
      
      // Import key for AES-GCM
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        key,
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      );
      
      // Decrypt
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        encrypted
      );
      
      const decoder = new TextDecoder();
      const decryptedText = decoder.decode(decrypted);
      
      return JSON.parse(decryptedText);
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error(`Message decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get storage key for a message
   */
  private getMessageKey(messageId: string): string {
    return `${this.storagePrefix}.message.${messageId}`;
  }

  /**
   * Get storage key for conversation index
   */
  private getConversationKey(conversationId: string): string {
    return `${this.storagePrefix}.conversation.${conversationId}`;
  }

  /**
   * Get storage key for queue
   */
  private getQueueKey(): string {
    return `${this.storagePrefix}.queue`;
  }

  /**
   * Persist a message to storage with encryption
   */
  async persistMessage(message: Message): Promise<void> {
    try {
      // Encrypt sensitive data
      const encryptedData = await this.encryptMessageData(message);
      
      // Store message with encrypted data
      const storedMessage = {
        id: message.id,
        conversationId: message.conversationId,
        timestamp: message.timestamp.getTime(),
        isOutgoing: message.isOutgoing,
        status: message.status,
        eventId: message.eventId,
        eventCreatedAt: message.eventCreatedAt?.getTime(),
        senderPubkey: message.senderPubkey,
        recipientPubkey: message.recipientPubkey,
        syncedAt: message.syncedAt?.getTime(),
        retryCount: message.retryCount,
        deletedAt: message.deletedAt?.getTime(),
        relayResults: message.relayResults,
        encryptedData
      };
      
      // Store message
      const messageKey = this.getMessageKey(message.id);
      localStorage.setItem(messageKey, JSON.stringify(storedMessage));
      
      // Update conversation index
      await this.updateConversationIndex(message.conversationId, message.id, message.timestamp);
      
      // Cleanup old messages if needed
      await this.cleanupConversationMessages(message.conversationId);
    } catch (error) {
      console.error('Failed to persist message:', error);
      throw new Error(`Message persistence failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update conversation index with new message
   */
  private async updateConversationIndex(conversationId: string, messageId: string, timestamp: Date): Promise<void> {
    const conversationKey = this.getConversationKey(conversationId);
    const stored = localStorage.getItem(conversationKey);
    
    let index: { messageIds: string[]; timestamps: Record<string, number> } = {
      messageIds: [],
      timestamps: {}
    };
    
    if (stored) {
      index = JSON.parse(stored);
    }
    
    // Add or update message in index
    if (!index.messageIds.includes(messageId)) {
      index.messageIds.push(messageId);
    }
    index.timestamps[messageId] = timestamp.getTime();
    
    localStorage.setItem(conversationKey, JSON.stringify(index));
  }

  /**
   * Update message status
   */
  async updateMessageStatus(messageId: string, status: MessageStatus): Promise<void> {
    try {
      const messageKey = this.getMessageKey(messageId);
      const stored = localStorage.getItem(messageKey);
      
      if (!stored) {
        throw new Error(`Message ${messageId} not found`);
      }
      
      const storedMessage = JSON.parse(stored);
      storedMessage.status = status;
      
      localStorage.setItem(messageKey, JSON.stringify(storedMessage));
    } catch (error) {
      console.error('Failed to update message status:', error);
      throw new Error(`Status update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get a single message by ID
   */
  async getMessage(messageId: string): Promise<Message | null> {
    try {
      const messageKey = this.getMessageKey(messageId);
      const stored = localStorage.getItem(messageKey);
      
      if (!stored) {
        return null;
      }
      
      const storedMessage = JSON.parse(stored);
      
      // Decrypt sensitive data
      const decryptedData = await this.decryptMessageData(storedMessage.encryptedData);
      
      // Reconstruct message
      return {
        id: storedMessage.id,
        conversationId: storedMessage.conversationId,
        content: decryptedData.content,
        timestamp: new Date(storedMessage.timestamp),
        isOutgoing: storedMessage.isOutgoing,
        status: storedMessage.status,
        eventId: storedMessage.eventId,
        eventCreatedAt: storedMessage.eventCreatedAt ? new Date(storedMessage.eventCreatedAt) : undefined,
        senderPubkey: storedMessage.senderPubkey,
        recipientPubkey: storedMessage.recipientPubkey,
        encryptedContent: decryptedData.encryptedContent,
        relayResults: storedMessage.relayResults,
        syncedAt: storedMessage.syncedAt ? new Date(storedMessage.syncedAt) : undefined,
        retryCount: storedMessage.retryCount,
        attachment: decryptedData.attachment,
        replyTo: decryptedData.replyTo,
        reactions: decryptedData.reactions,
        deletedAt: storedMessage.deletedAt ? new Date(storedMessage.deletedAt) : undefined
      };
    } catch (error) {
      console.error('Failed to get message:', error);
      return null;
    }
  }

  /**
   * Get messages for a conversation with pagination
   */
  async getMessages(conversationId: string, options: PaginationOptions = {}): Promise<Message[]> {
    try {
      const conversationKey = this.getConversationKey(conversationId);
      const stored = localStorage.getItem(conversationKey);
      
      if (!stored) {
        return [];
      }
      
      const index = JSON.parse(stored);
      const messages: Message[] = [];
      
      // Load all messages
      for (const messageId of index.messageIds) {
        const message = await this.getMessage(messageId);
        if (message) {
          // Apply date filters
          if (options.before && message.timestamp >= options.before) {
            continue;
          }
          if (options.after && message.timestamp <= options.after) {
            continue;
          }
          
          messages.push(message);
        }
      }
      
      // Sort by timestamp (newest first for UI display)
      messages.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      
      // Apply pagination
      const offset = options.offset || 0;
      const limit = options.limit || messages.length;
      
      return messages.slice(offset, offset + limit);
    } catch (error) {
      console.error('Failed to get messages:', error);
      return [];
    }
  }

  /**
   * Queue an outgoing message for retry
   */
  async queueOutgoingMessage(message: OutgoingMessage): Promise<void> {
    try {
      const queueKey = this.getQueueKey();
      const stored = localStorage.getItem(queueKey);
      
      let queue: Record<string, any> = {};
      if (stored) {
        queue = JSON.parse(stored);
      }
      
      queue[message.id] = {
        ...message,
        createdAt: message.createdAt.getTime(),
        nextRetryAt: message.nextRetryAt.getTime()
      };
      
      localStorage.setItem(queueKey, JSON.stringify(queue));
    } catch (error) {
      console.error('Failed to queue message:', error);
      throw new Error(`Message queuing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all queued messages ready for retry
   */
  async getQueuedMessages(): Promise<OutgoingMessage[]> {
    try {
      const queueKey = this.getQueueKey();
      const stored = localStorage.getItem(queueKey);
      
      if (!stored) {
        return [];
      }
      
      const queue = JSON.parse(stored);
      const messages: OutgoingMessage[] = [];
      const now = Date.now();
      
      for (const [, queuedMessage] of Object.entries(queue)) {
        const msg = queuedMessage as any;
        
        // Only return messages ready for retry
        if (msg.nextRetryAt <= now && msg.retryCount < MAX_RETRY_ATTEMPTS) {
          messages.push({
            id: msg.id,
            conversationId: msg.conversationId,
            content: msg.content,
            recipientPubkey: msg.recipientPubkey,
            createdAt: new Date(msg.createdAt),
            retryCount: msg.retryCount,
            nextRetryAt: new Date(msg.nextRetryAt),
            signedEvent: msg.signedEvent
          });
        }
      }
      
      return messages;
    } catch (error) {
      console.error('Failed to get queued messages:', error);
      return [];
    }
  }

  /**
   * Remove a message from the retry queue
   */
  async removeFromQueue(messageId: string): Promise<void> {
    try {
      const queueKey = this.getQueueKey();
      const stored = localStorage.getItem(queueKey);
      
      if (!stored) {
        return;
      }
      
      const queue = JSON.parse(stored);
      delete queue[messageId];
      
      localStorage.setItem(queueKey, JSON.stringify(queue));
    } catch (error) {
      console.error('Failed to remove from queue:', error);
    }
  }

  /**
   * Get the timestamp of the last message in a conversation
   */
  async getLastMessageTimestamp(conversationId: string): Promise<Date | null> {
    try {
      const messages = await this.getMessages(conversationId, { limit: 1 });
      return messages.length > 0 ? messages[messages.length - 1].timestamp : null;
    } catch (error) {
      console.error('Failed to get last message timestamp:', error);
      return null;
    }
  }

  /**
   * Mark messages as synced
   */
  async markMessagesSynced(messageIds: string[]): Promise<void> {
    try {
      const syncTime = Date.now();
      
      for (const messageId of messageIds) {
        const messageKey = this.getMessageKey(messageId);
        const stored = localStorage.getItem(messageKey);
        
        if (stored) {
          const storedMessage = JSON.parse(stored);
          storedMessage.syncedAt = syncTime;
          localStorage.setItem(messageKey, JSON.stringify(storedMessage));
        }
      }
    } catch (error) {
      console.error('Failed to mark messages as synced:', error);
    }
  }

  /**
   * Clean up old messages
   */
  async cleanupOldMessages(olderThan: Date): Promise<void> {
    try {
      const cutoffTime = olderThan.getTime();
      
      // Iterate through all storage keys for this identity
      const keysToRemove: string[] = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`${this.storagePrefix}.message.`)) {
          const stored = localStorage.getItem(key);
          if (stored) {
            const message = JSON.parse(stored);
            if (message.timestamp < cutoffTime) {
              keysToRemove.push(key);
              
              // Also remove from conversation index
              const conversationKey = this.getConversationKey(message.conversationId);
              const conversationStored = localStorage.getItem(conversationKey);
              if (conversationStored) {
                const index = JSON.parse(conversationStored);
                index.messageIds = index.messageIds.filter((id: string) => id !== message.id);
                delete index.timestamps[message.id];
                localStorage.setItem(conversationKey, JSON.stringify(index));
              }
            }
          }
        }
      }
      
      // Remove old messages
      for (const key of keysToRemove) {
        localStorage.removeItem(key);
      }
    } catch (error) {
      console.error('Failed to cleanup old messages:', error);
    }
  }

  /**
   * Get storage usage statistics
   */
  async getStorageUsage(): Promise<StorageStats> {
    try {
      let totalMessages = 0;
      let totalSizeBytes = 0;
      let oldestMessage: Date | undefined;
      let newestMessage: Date | undefined;
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`${this.storagePrefix}.message.`)) {
          const stored = localStorage.getItem(key);
          if (stored) {
            totalMessages++;
            totalSizeBytes += stored.length;
            
            const message = JSON.parse(stored);
            const messageTime = new Date(message.timestamp);
            
            if (!oldestMessage || messageTime < oldestMessage) {
              oldestMessage = messageTime;
            }
            if (!newestMessage || messageTime > newestMessage) {
              newestMessage = messageTime;
            }
          }
        }
      }
      
      return {
        totalMessages,
        totalSizeBytes,
        oldestMessage,
        newestMessage
      };
    } catch (error) {
      console.error('Failed to get storage usage:', error);
      return { totalMessages: 0, totalSizeBytes: 0 };
    }
  }

  /**
   * Clean up messages in a conversation to stay under the limit
   */
  private async cleanupConversationMessages(conversationId: string): Promise<void> {
    try {
      const messages = await this.getMessages(conversationId);
      
      if (messages.length > MAX_MESSAGES_PER_CONVERSATION) {
        // Messages are already sorted newest first from getMessages
        // Keep the first MAX_MESSAGES_PER_CONVERSATION (newest)
        // Remove the rest (oldest)
        const toRemove = messages.slice(MAX_MESSAGES_PER_CONVERSATION);
        
        for (const message of toRemove) {
          const messageKey = this.getMessageKey(message.id);
          localStorage.removeItem(messageKey);
        }
        
        // Update conversation index
        const conversationKey = this.getConversationKey(conversationId);
        const stored = localStorage.getItem(conversationKey);
        if (stored) {
          const index = JSON.parse(stored);
          const remainingIds = messages.slice(0, MAX_MESSAGES_PER_CONVERSATION).map(m => m.id);
          index.messageIds = index.messageIds.filter((id: string) => remainingIds.includes(id));
          
          // Clean up timestamps
          const newTimestamps: Record<string, number> = {};
          for (const id of remainingIds) {
            if (index.timestamps[id]) {
              newTimestamps[id] = index.timestamps[id];
            }
          }
          index.timestamps = newTimestamps;
          
          localStorage.setItem(conversationKey, JSON.stringify(index));
        }
      }
    } catch (error) {
      console.error('Failed to cleanup conversation messages:', error);
    }
  }
}