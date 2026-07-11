"use client";

import { useSyncExternalStore } from "react";
import type { MediaItem } from "../types";

export type MediaPreviewScope = Readonly<{
    conversationDisplayName: string;
    items: ReadonlyArray<MediaItem>;
}>;

const EMPTY_SCOPE: MediaPreviewScope = {
    conversationDisplayName: "",
    items: [],
};

let scope: MediaPreviewScope = EMPTY_SCOPE;
const listeners = new Set<() => void>();

const emit = (): void => {
    listeners.forEach((listener) => {
        listener();
    });
};

const getSnapshot = (): MediaPreviewScope => scope;

const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener);
    return (): void => {
        listeners.delete(listener);
    };
};

export const setMediaPreviewScope = (next: MediaPreviewScope): void => {
    scope = next;
    emit();
};

export const clearMediaPreviewScope = (): void => {
    if (scope.items.length === 0 && scope.conversationDisplayName === "") {
        return;
    }
    scope = EMPTY_SCOPE;
    emit();
};

export const useMediaPreviewScope = (): MediaPreviewScope => (
    useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_SCOPE)
);
