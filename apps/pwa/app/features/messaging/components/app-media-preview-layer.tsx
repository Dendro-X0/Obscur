"use client";

import type React from "react";
import { usePathname } from "next/navigation";
import { useMessaging } from "../providers/messaging-provider";
import { useMediaPreviewScope } from "../services/media-preview-scope";
import { Lightbox } from "./lightbox";
import { MediaGallery } from "./media-gallery";

const isChatRoutePath = (pathname: string | null): boolean => pathname === "/";

/**
 * App-layer host for chat media preview overlays (gallery + lightbox).
 * Mounted from the unlocked runtime shell so previews sit above chrome/sidebar.
 */
export function AppMediaPreviewLayer(): React.JSX.Element | null {
    const pathname = usePathname();
    const {
        isMediaGalleryOpen,
        setIsMediaGalleryOpen,
        lightboxIndex,
        setLightboxIndex,
    } = useMessaging();
    const { conversationDisplayName, items } = useMediaPreviewScope();

    if (!isChatRoutePath(pathname)) {
        return null;
    }

    const activeLightboxItem = lightboxIndex !== null ? items[lightboxIndex] : undefined;

    return (
        <>
            <MediaGallery
                isOpen={isMediaGalleryOpen}
                onClose={() => setIsMediaGalleryOpen(false)}
                conversationDisplayName={conversationDisplayName}
                mediaItems={items}
                onSelect={setLightboxIndex}
            />
            {activeLightboxItem ? (
                <Lightbox
                    item={activeLightboxItem}
                    onClose={() => setLightboxIndex(null)}
                    onPrev={() => setLightboxIndex(lightboxIndex! - 1)}
                    onNext={() => setLightboxIndex(lightboxIndex! + 1)}
                    hasPrev={lightboxIndex! > 0}
                    hasNext={lightboxIndex! < items.length - 1}
                    activeIndex={lightboxIndex!}
                    totalItems={items.length}
                />
            ) : null}
        </>
    );
}
