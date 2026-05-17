"use client";

import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import type { Message } from "../types";

export type MessageBusEvent =
    | { type: 'new_message'; conversationId: string; message: Message }
    | { type: 'message_updated'; conversationId: string; message: Message }
    | { type: 'message_deleted'; conversationId: string; messageId: string; messageIdentityIds?: ReadonlyArray<string>; conversationIdOriginal?: string };

type MessageBusHandler = (event: MessageBusEvent) => void;

export type MessageBusSubscribeOptions = Readonly<{
    /** When set, only events emitted for this profile are delivered. */
    profileId?: string;
}>;

export type MessageBusEmitOptions = Readonly<{
    /** Profile that originated the event; defaults to `getResolvedProfileId()` when omitted. */
    sourceProfileId?: string;
}>;

type TaggedMessageBusEvent = MessageBusEvent & Readonly<{ _sourceProfileId: string }>;
type TaggedMessageBusHandler = (event: TaggedMessageBusEvent) => void;

const resolveEmitProfileId = (explicit?: string): string => {
    const trimmed = explicit?.trim();
    if (trimmed) {
        return trimmed;
    }
    try {
        return getResolvedProfileId().trim();
    } catch {
        return "";
    }
};

const shouldDeliverToSubscriber = (
    eventProfileId: string,
    subscriberProfileId: string,
): boolean => {
    if (!subscriberProfileId) {
        return true;
    }
    if (!eventProfileId) {
        return false;
    }
    return eventProfileId === subscriberProfileId;
};

/**
 * MessageBus Service
 *
 * Provides a transient, high-performance event stream for messaging events.
 * Decouples the message processing logic from the React rendering tree.
 *
 * Events are tagged with a source profile id so single-process multi-profile
 * windows do not apply one profile's optimistic deletes to another's UI.
 */
class MessageBus {
    private handlers = new Set<TaggedMessageBusHandler>();

    /**
     * Subscribe to messaging events, optionally scoped to one profile.
     * Returns an unsubscribe function.
     */
    subscribe(handler: MessageBusHandler, options?: MessageBusSubscribeOptions): () => void {
        const filterProfileId = options?.profileId?.trim() ?? "";
        const wrapped: TaggedMessageBusHandler = (tagged) => {
            if (!shouldDeliverToSubscriber(tagged._sourceProfileId, filterProfileId)) {
                return;
            }
            const { _sourceProfileId: _ignored, ...publicEvent } = tagged;
            handler(publicEvent);
        };

        this.handlers.add(wrapped);
        return () => {
            this.handlers.delete(wrapped);
        };
    }

    /**
     * Emit a messaging event to subscribers for the originating profile.
     */
    emit(event: MessageBusEvent, options?: MessageBusEmitOptions): void {
        const tagged: TaggedMessageBusEvent = {
            ...event,
            _sourceProfileId: resolveEmitProfileId(options?.sourceProfileId),
        };
        this.handlers.forEach((handler) => {
            try {
                handler(tagged);
            } catch (e) {
                console.error("[MessageBus] Error in subscriber handler:", e);
            }
        });
    }

    /**
     * Helper to emit a new message event.
     */
    emitNewMessage(
        conversationId: string,
        message: Message,
        options?: MessageBusEmitOptions,
    ): void {
        this.emit({ type: 'new_message', conversationId, message }, options);
    }

    /**
     * Helper to emit a message update event.
     */
    emitMessageUpdated(
        conversationId: string,
        message: Message,
        options?: MessageBusEmitOptions,
    ): void {
        this.emit({ type: 'message_updated', conversationId, message }, options);
    }

    /**
     * Helper to emit a message deletion event.
     */
    emitMessageDeleted(
        conversationId: string,
        messageId: string,
        options?: Readonly<{
            messageIdentityIds?: ReadonlyArray<string>;
            conversationIdOriginal?: string;
            sourceProfileId?: string;
        }>,
    ): void {
        this.emit({
            type: 'message_deleted',
            conversationId,
            messageId,
            ...(options?.messageIdentityIds && options.messageIdentityIds.length > 0
                ? { messageIdentityIds: options.messageIdentityIds }
                : {}),
            ...(options?.conversationIdOriginal
                ? { conversationIdOriginal: options.conversationIdOriginal }
                : {}),
        }, { sourceProfileId: options?.sourceProfileId });
    }
}

export const messageBus = new MessageBus();
