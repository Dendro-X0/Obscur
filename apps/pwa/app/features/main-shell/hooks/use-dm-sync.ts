"use client";

import { useEffect, useRef } from "react";
import type { Message, UnreadByConversationId } from "@/app/features/messaging/types";
import { messageBus } from "@/app/features/messaging/services/message-bus";

/** Quiet period after message list churn before treating new IDs as live unread (hydration is often multi-pass). */
const DEFAULT_SETTLE_DEBOUNCE_MS = 400;
/** Cap how long we wait for hydration bursts before allowing live unread classification anyway. */
const SETTLE_FORCE_MS = 4_000;
/** If we have a last-viewed timestamp for the thread, do not count older incoming events as unread (restart / resync). */
const LAST_VIEWED_MESSAGE_GRACE_MS = 120_000;

/**
 * Hook to sync messages from DmController to the unified message store.
 *
 * @param selectedDmConversationId When set, the user is focused on this **DM** thread (not group / other).
 *        Must be null when the active surface is not a DM, otherwise group ids were compared to DM cids
 *        and every historical replay inflated unread.
 */
export function useDmSync(
    dmMessages: ReadonlyArray<Message>,
    selectedDmConversationId: string | null,
    setUnreadByConversationId: React.Dispatch<React.SetStateAction<UnreadByConversationId>>,
    isReady: boolean = true,
    hasHydrated: boolean = true,
    lastViewedByConversationId: Readonly<Record<string, number>> = {},
    settleDebounceMs: number = DEFAULT_SETTLE_DEBOUNCE_MS,
) {
    const prevMessagesRef = useRef<Record<string, Message>>({});
    const seenMessageIdsRef = useRef<Set<string>>(new Set());
    const hasInitializedRef = useRef(false);
    const settleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const forceSettleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const firstReadyHydratedAtRef = useRef<number | null>(null);
    const forceSettleArmedRef = useRef(false);

    const clearDebounceTimer = (): void => {
        if (settleTimeoutRef.current !== null) {
            clearTimeout(settleTimeoutRef.current);
            settleTimeoutRef.current = null;
        }
    };

    const clearForceTimer = (): void => {
        if (forceSettleTimeoutRef.current !== null) {
            clearTimeout(forceSettleTimeoutRef.current);
            forceSettleTimeoutRef.current = null;
        }
        forceSettleArmedRef.current = false;
    };

    useEffect(() => {
        const clearDebounceOnExit = (): void => {
            clearDebounceTimer();
        };

        if (!isReady || !hasHydrated) {
            clearDebounceTimer();
            clearForceTimer();
            hasInitializedRef.current = false;
            firstReadyHydratedAtRef.current = null;
            return clearDebounceOnExit;
        }

        if (firstReadyHydratedAtRef.current === null) {
            firstReadyHydratedAtRef.current = Date.now();
            if (settleDebounceMs > 0 && !forceSettleArmedRef.current) {
                forceSettleArmedRef.current = true;
                forceSettleTimeoutRef.current = setTimeout(() => {
                    forceSettleTimeoutRef.current = null;
                    forceSettleArmedRef.current = false;
                    hasInitializedRef.current = true;
                    clearDebounceTimer();
                }, SETTLE_FORCE_MS);
            }
        }

        const unreadUpdates: Record<string, number> = {};
        const currentMessages: Record<string, Message> = {};

        const liveIds = new Set(dmMessages.map(m => m.id));
        if (liveIds.size > 0 && seenMessageIdsRef.current.size > liveIds.size * 3) {
            const pruned = new Set<string>();
            seenMessageIdsRef.current.forEach(id => {
                if (liveIds.has(id)) pruned.add(id);
            });
            seenMessageIdsRef.current = pruned;
        }

        dmMessages.forEach(m => {
            currentMessages[m.id] = m;
            const cid = m.conversationId;
            if (!cid) return;

            const prev = prevMessagesRef.current[m.id];
            const hasSeen = seenMessageIdsRef.current.has(m.id);

            if (!prev) {
                if (hasInitializedRef.current && !hasSeen) {
                    messageBus.emitNewMessage(cid, m);

                    if (!m.isOutgoing && (selectedDmConversationId == null || selectedDmConversationId !== cid)) {
                        const lastSeenMs = lastViewedByConversationId[cid] ?? 0;
                        const messageTimeMs = m.eventCreatedAt?.getTime() ?? m.timestamp.getTime();
                        const alreadyReadByLastView = (
                            lastSeenMs > 0
                            && Number.isFinite(messageTimeMs)
                            && messageTimeMs <= lastSeenMs + LAST_VIEWED_MESSAGE_GRACE_MS
                        );
                        if (!alreadyReadByLastView) {
                            unreadUpdates[cid] = (unreadUpdates[cid] || 0) + 1;
                        }
                    }
                }
            } else if (
                prev.status !== m.status
                || prev.content !== m.content
                || prev.eventId !== m.eventId
                || prev.relayPublishedEventId !== m.relayPublishedEventId
                || JSON.stringify(prev.reactions) !== JSON.stringify(m.reactions)
            ) {
                messageBus.emitMessageUpdated(cid, m);
            }

            seenMessageIdsRef.current.add(m.id);
        });

        prevMessagesRef.current = currentMessages;

        if (settleDebounceMs <= 0) {
            hasInitializedRef.current = true;
            clearDebounceTimer();
            clearForceTimer();
        } else {
            clearDebounceTimer();
            settleTimeoutRef.current = setTimeout(() => {
                settleTimeoutRef.current = null;
                hasInitializedRef.current = true;
                clearForceTimer();
            }, settleDebounceMs);
        }

        if (Object.keys(unreadUpdates).length > 0) {
            setUnreadByConversationId(prev => {
                const next = { ...prev };
                Object.entries(unreadUpdates).forEach(([cid, count]) => {
                    next[cid] = (next[cid] || 0) + count;
                });
                return next;
            });
        }

        return clearDebounceOnExit;
    }, [
        dmMessages,
        selectedDmConversationId,
        setUnreadByConversationId,
        isReady,
        hasHydrated,
        lastViewedByConversationId,
        settleDebounceMs,
    ]);
}
