"use client";

import type React from "react";
import { APP_OVERLAY_BACKDROP_CLASS, APP_OVERLAY_Z_INDEX_CLASS, AppOverlayPortal } from "@/app/components/app-overlay-layer";

/** @deprecated Prefer `APP_OVERLAY_*` from `@/app/components/app-overlay-layer`. */
export const MESSAGING_OVERLAY_Z_INDEX_CLASS = APP_OVERLAY_Z_INDEX_CLASS;

/** @deprecated Prefer `APP_OVERLAY_BACKDROP_CLASS` from `@/app/components/app-overlay-layer`. */
export const MESSAGING_OVERLAY_BACKDROP_CLASS = APP_OVERLAY_BACKDROP_CLASS;

/** @deprecated Prefer `AppOverlayPortal` from `@/app/components/app-overlay-layer`. */
export function MessagingOverlayPortal(props: Readonly<{ children: React.ReactNode }>): React.JSX.Element | null {
    return <AppOverlayPortal>{props.children}</AppOverlayPortal>;
}
