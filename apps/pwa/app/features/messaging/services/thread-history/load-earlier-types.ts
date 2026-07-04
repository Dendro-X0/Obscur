/**
 * Thread history load-earlier pagination contracts.
 */
import type { Message } from "../../types";

export type LoadEarlierDmConversationMessagesParams = Readonly<{
  conversationId: string;
  conversationAliasIds: ReadonlyArray<string>;
  earliestTimestampMs: number;
  loadEarlierBatchSize: number;
  publicKeyHex: string | null;
  persistentSuppressedMessageIds: ReadonlySet<string>;
  localMessageRetentionDays: number | undefined;
  existingMessages: ReadonlyArray<Message>;
}>;

export type LoadEarlierDmConversationMessagesResult = Readonly<{
  messages: ReadonlyArray<Message>;
  hasEarlier: boolean;
  didExpandHistory: boolean;
}>;
