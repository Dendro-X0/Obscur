/**
 * What this **client build** can do for storage and session UX.
 * Use for feature gates and tests — do not infer Tor or multi-profile from storage API alone.
 */
export type ClientStorageCapabilities = Readonly<{
    /** True when Tor can be started from this build (e.g. bundled in Tauri). */
    torBundled: boolean;
    /** True when multiple profiles can run in one JS process (e.g. desktop shell). */
    multiProfileSameProcess: boolean;
    /** True when materialized message/chat state can live in SQL on device. */
    sqlMaterialization: boolean;
}>;

/** Typical Chromium PWA / generic web — no bundled Tor, no in-process multi-profile. */
export const PWA_GENERIC_WEB_CAPABILITIES: ClientStorageCapabilities = {
    torBundled: false,
    multiProfileSameProcess: false,
    sqlMaterialization: false,
};

/** Tauri desktop — adjust if a build variant differs. */
export const DESKTOP_TAURI_CAPABILITIES: ClientStorageCapabilities = {
    torBundled: true,
    multiProfileSameProcess: true,
    sqlMaterialization: true,
};
