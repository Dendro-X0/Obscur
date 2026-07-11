"use client";

import React from "react";
import type { MediaItem } from "../types";
import { clearMediaPreviewScope, setMediaPreviewScope } from "../services/media-preview-scope";

type SyncMediaPreviewScopeParams = Readonly<{
    conversationDisplayName: string;
    items: ReadonlyArray<MediaItem>;
}>;

/** Publishes the active chat's previewable media list to the app-layer preview host. */
export function useSyncMediaPreviewScope(params: SyncMediaPreviewScopeParams): void {
    const itemsSignature = React.useMemo(
        () => params.items.map((item) => `${item.messageId}:${item.attachment.url}`).join("|"),
        [params.items],
    );

    React.useLayoutEffect(() => {
        if (params.items.length === 0 && params.conversationDisplayName.trim() === "") {
            clearMediaPreviewScope();
            return;
        }
        setMediaPreviewScope({
            conversationDisplayName: params.conversationDisplayName,
            items: params.items,
        });
        return (): void => {
            clearMediaPreviewScope();
        };
    }, [params.conversationDisplayName, itemsSignature, params.items]);
}
