"use client";

import React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/app/lib/utils";

export const APP_OVERLAY_ROOT_ID = "obscur-app-overlay-root";

/** Above desktop title bar (`z-[9999]`) and app shell sidebar (`z-[2600]`). */
export const APP_OVERLAY_Z_INDEX_CLASS = "z-[10100]";

export const APP_OVERLAY_BACKDROP_CLASS = [
    APP_OVERLAY_Z_INDEX_CLASS,
    "fixed inset-0",
    "bg-black/75 backdrop-blur-sm",
    "dark:bg-black/80",
].join(" ");

/** Canonical mount point for fullscreen overlays (media preview, vault preview, etc.). */
export function AppOverlayRoot(): React.JSX.Element {
    return (
        <div
            id={APP_OVERLAY_ROOT_ID}
            className={cn(APP_OVERLAY_Z_INDEX_CLASS, "pointer-events-none fixed inset-0 isolate")}
        />
    );
}

export function AppOverlayPortal(props: Readonly<{ children: React.ReactNode }>): React.JSX.Element | null {
    const [portalRoot, setPortalRoot] = React.useState<HTMLElement | null>(null);

    React.useLayoutEffect(() => {
        if (typeof document === "undefined") {
            return;
        }
        setPortalRoot(document.getElementById(APP_OVERLAY_ROOT_ID));
    }, []);

    if (!portalRoot) {
        return null;
    }

    return createPortal(
        <div className="pointer-events-auto fixed inset-0">{props.children}</div>,
        portalRoot,
    );
}
