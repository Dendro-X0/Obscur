/**
 * Canonical floating UI z-index tiers (ascending).
 * Use these string literals so Tailwind can emit matching rules.
 */
export const UI_OVERLAY_Z_CLASS = {
    dialogBackdrop: "z-[5000]",
    dialogPanel: "z-[5001]",
    popover: "z-[5100]",
    toast: "z-[5200]",
} as const;

export const UI_OVERLAY_Z_INDEX = {
    dialogBackdrop: 5000,
    dialogPanel: 5001,
    popover: 5100,
    toast: 5200,
} as const;
