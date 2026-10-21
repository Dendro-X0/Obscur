"use client";

import React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/app/lib/utils";

export const APP_OVERLAY_ROOT_ID = "obscur-app-overlay-root";

/** Above desktop title bar (`z-[9999]`) and app shell sidebar (`z-[2600]`). */
export const APP_OVERLAY_Z_INDEX_CLASS = "z-[10100]";

export const APP_OVERLAY_PORTAL_WRAPPER_CLASS = [
    APP_OVERLAY_Z_INDEX_CLASS,
    "pointer-events-auto fixed inset-0 isolate",
].join(" ");

export const APP_OVERLAY_BACKDROP_CLASS = [
    "absolute inset-0",
    "bg-black/75",
    "dark:bg-black/80",
].join(" ");

/**
 * Legacy anchor kept for layout parity; overlays portal to `document.body` so they
 * escape the Tauri desktop shell (`desktop-window-glow` overflow / WebView2 compositing).
 */
export function AppOverlayRoot(): React.JSX.Element {
    return (
        <div
            id={APP_OVERLAY_ROOT_ID}
            className={cn(APP_OVERLAY_Z_INDEX_CLASS, "pointer-events-none fixed inset-0 isolate")}
            aria-hidden="true"
        />
    );
}

export function AppOverlayPortal(props: Readonly<{ children: React.ReactNode }>): React.JSX.Element | null {
    const [mounted, setMounted] = React.useState(false);

    React.useLayoutEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted || typeof document === "undefined") {
        return null;
    }

    return createPortal(
        <div className={APP_OVERLAY_PORTAL_WRAPPER_CLASS} data-testid="app-overlay-portal">
            {props.children}
        </div>,
        document.body,
    );
}
