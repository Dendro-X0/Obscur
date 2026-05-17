import type { Message } from "../types";

export type MessageBusEvent =
    | { type: 'new_message'; conversationId: string; message: Message }
    | { type: 'message_updated'; conversationId: string; message: Message }
    | { type: 'message_deleted'; conversationId: string; messageId: string; messageIdentityIds?: ReadonlyArray<string>; conversationIdOriginal?: string };

type MessageBusHandler = (event: MessageBusEvent) => void;

/**
 * MessageBus Service
 * 
 * Provides a transient, high-performance event stream for messaging events.
 * Decouples the message processing logic from the React rendering tree.
 */
class MessageBus {
    private handlers = new Set<MessageBusHandler>();

    /**
     * Subscribe to all messaging events.
     * Returns an unsubscribe function.
     */
    subscribe(handler: MessageBusHandler): () => void {
        this.handlers.add(handler);
        return () => {
            this.handlers.delete(handler);
        };
    }

    /**
     * Emit a messaging event to all active subscribers.
     */
    emit(event: MessageBusEvent): void {
        this.handlers.forEach(handler => {
            try {
                handler(event);
            } catch (e) {
                console.error("[MessageBus] Error in subscriber handler:", e);
            }
        });
    }

    /**
     * Helper to emit a new message event.
     */
    emitNewMessage(conversationId: string, message: Message): void {
        this.emit({ type: 'new_message', conversationId, message });
    }

    /**
     * Helper to emit a message update event.
     */
    emitMessageUpdated(conversationId: string, message: Message): void {
        this.emit({ type: 'message_updated', conversationId, message });
    }

    /**
     * Helper to emit a message deletion event.
     */
    emitMessageDeleted(
        conversationId: string,
        messageId: string,
        options?: Readonly<{ messageIdentityIds?: ReadonlyArray<string> }>
    ): void {
        this.emit({
            type: 'message_deleted',
            conversationId,
            messageId,
            ...(options?.messageIdentityIds && options.messageIdentityIds.length > 0
                ? { messageIdentityIds: options.messageIdentityIds }
                : {}),
        });
    }
}

export const messageBus = new MessageBus();
