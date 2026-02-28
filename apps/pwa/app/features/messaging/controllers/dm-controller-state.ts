import type { Message, MessageStatus } from "../lib/message-queue";
import { errorHandler, type MessageError, type NetworkState } from "../lib/error-handler";
import type { QueueStatus } from "../lib/offline-queue-manager";

/**
 * Nostr filter for subscriptions
 */
export type NostrFilter = Readonly<{
  kinds: number[];
  authors?: string[];
  "#p"?: string[];
  since?: number;
  until?: number;
  limit?: number;
}>;

export type Subscription = Readonly<{
  id: string;
  filter: NostrFilter;
  isActive: boolean;
  createdAt: Date;
  lastEventAt?: Date;
  eventCount: number;
}>;

export type EnhancedDMControllerState = Readonly<{
  status: "initializing" | "ready" | "error";
  error?: string;
  messages: ReadonlyArray<Message>;
  subscriptions: ReadonlyArray<Subscription>;
  syncProgress?: {
    total: number;
    completed: number;
    errors: number;
  };
  messageStatusMap: Readonly<Record<string, MessageStatus>>;
  networkState: NetworkState;
  lastError?: MessageError;
  queueStatus?: QueueStatus;
}>;

export const isValidStatusTransition = (from: MessageStatus, to: MessageStatus): boolean => {
  const validTransitions: Record<MessageStatus, MessageStatus[]> = {
    sending: ["accepted", "rejected", "queued", "failed"],
    queued: ["sending", "failed"],
    accepted: ["delivered"],
    rejected: ["queued", "failed"],
    delivered: [],
    failed: ["queued", "sending"]
  };

  return validTransitions[from]?.includes(to) || false;
};

export const createInitialState = (): EnhancedDMControllerState => ({
  status: "initializing",
  messages: [],
  subscriptions: [],
  messageStatusMap: {},
  networkState: errorHandler.getNetworkState()
});

export const createErrorState = (message: string, prevMessages: ReadonlyArray<Message> = [], lastError?: MessageError): EnhancedDMControllerState => ({
  status: "error",
  error: message,
  messages: prevMessages,
  subscriptions: [],
  messageStatusMap: {},
  networkState: errorHandler.getNetworkState(),
  lastError
});

export const createReadyState = (messages: ReadonlyArray<Message>): EnhancedDMControllerState => {
  const messageStatusMap: Record<string, MessageStatus> = {};
  messages.forEach(msg => {
    if (msg.id) messageStatusMap[msg.id] = msg.status;
    if (msg.eventId) messageStatusMap[msg.eventId] = msg.status;
  });

  return {
    status: "ready",
    messages,
    subscriptions: [],
    messageStatusMap,
    networkState: errorHandler.getNetworkState()
  };
};
