"use client";

import type React from "react";
import type { Attachment } from "../types";
import {
    MESSAGE_BUBBLE_LONG_PRESS_MOVE_TOLERANCE_PX,
    MESSAGE_BUBBLE_SUSTAIN_HOVER_DELAY_MS,
    shouldCancelMessageBubbleSustainHover,
} from "./message-list-touch";
import type { AttachmentContextMenuState } from "./attachment-context-menu";

export type OpenAttachmentContextMenu = (params: NonNullable<AttachmentContextMenuState>) => void;

type LongPressSession = Readonly<{
    attachment: Attachment;
    startX: number;
    startY: number;
}>;

const longPressSessions = new WeakMap<HTMLElement, LongPressSession>();
const longPressTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();
const longPressFiredElements = new WeakSet<HTMLElement>();

const clearLongPress = (element: HTMLElement): void => {
    const timer = longPressTimers.get(element);
    if (timer) {
        clearTimeout(timer);
        longPressTimers.delete(element);
    }
    longPressSessions.delete(element);
};

export const getAttachmentContextMenuTriggerProps = (
    attachment: Attachment,
    onOpen: OpenAttachmentContextMenu,
): Readonly<{
    onContextMenu: (event: React.MouseEvent<HTMLElement>) => void;
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
    onPointerMove: (event: React.PointerEvent<HTMLElement>) => void;
    onPointerUp: (event: React.PointerEvent<HTMLElement>) => void;
    onPointerCancel: (event: React.PointerEvent<HTMLElement>) => void;
    onClickCapture: (event: React.MouseEvent<HTMLElement>) => void;
}> => ({
    onContextMenu: (event) => {
        event.preventDefault();
        event.stopPropagation();
        onOpen({
            attachment,
            x: event.clientX,
            y: event.clientY,
        });
    },
    onPointerDown: (event) => {
        if (event.pointerType !== "touch") {
            return;
        }
        const element = event.currentTarget;
        clearLongPress(element);
        longPressFiredElements.delete(element);
        longPressSessions.set(element, {
            attachment,
            startX: event.clientX,
            startY: event.clientY,
        });
        const timer = setTimeout(() => {
            longPressTimers.delete(element);
            const session = longPressSessions.get(element);
            if (!session) {
                return;
            }
            longPressFiredElements.add(element);
            onOpen({
                attachment: session.attachment,
                x: session.startX,
                y: session.startY,
            });
        }, MESSAGE_BUBBLE_SUSTAIN_HOVER_DELAY_MS);
        longPressTimers.set(element, timer);
        event.stopPropagation();
    },
    onPointerMove: (event) => {
        if (event.pointerType !== "touch") {
            return;
        }
        const element = event.currentTarget;
        const session = longPressSessions.get(element);
        if (!session) {
            return;
        }
        if (shouldCancelMessageBubbleSustainHover({
            startX: session.startX,
            startY: session.startY,
            currentX: event.clientX,
            currentY: event.clientY,
            tolerancePx: MESSAGE_BUBBLE_LONG_PRESS_MOVE_TOLERANCE_PX,
        })) {
            clearLongPress(element);
        }
    },
    onPointerUp: (event) => {
        if (event.pointerType !== "touch") {
            return;
        }
        clearLongPress(event.currentTarget);
    },
    onPointerCancel: (event) => {
        clearLongPress(event.currentTarget);
    },
    onClickCapture: (event) => {
        const element = event.currentTarget;
        if (!longPressFiredElements.has(element)) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        longPressFiredElements.delete(element);
    },
});

export const didAttachmentLongPressFire = (element: HTMLElement): boolean =>
    longPressFiredElements.has(element);

export const clearAttachmentLongPressFired = (element: HTMLElement): void => {
    longPressFiredElements.delete(element);
};
