/**
 * Build-time shell flags for static export variants (desktop Tauri vs mobile Tauri vs web).
 * Set at compile time via NEXT_PUBLIC_* env; do not infer product shell from CSS breakpoints alone.
 *
 * `NEXT_PUBLIC_MOBILE_PREVIEW` marks the desktop phone-preview harness (mobile UI + native SQLite).
 * It always implies mobile shell layouts; never set it on release Android/desktop builds.
 *
 * IMPORTANT: Next.js only inlines `process.env.NEXT_PUBLIC_*` when the key is a **string literal**.
 * Dynamic `process.env[KEY]` stays undefined in the client bundle and breaks mobile shell detection.
 */

export const DESKTOP_SHELL_ENV_KEY = "NEXT_PUBLIC_DESKTOP_SHELL" as const;
export const MOBILE_SHELL_ENV_KEY = "NEXT_PUBLIC_MOBILE_SHELL" as const;
export const MOBILE_PREVIEW_ENV_KEY = "NEXT_PUBLIC_MOBILE_PREVIEW" as const;

const readTruthyEnv = (value: string | undefined): boolean => (
  value === "1" || value === "true"
);

export const isDesktopShellBuild = (): boolean => (
  readTruthyEnv(process.env.NEXT_PUBLIC_DESKTOP_SHELL)
);

export const isMobileShellBuild = (): boolean => (
  readTruthyEnv(process.env.NEXT_PUBLIC_MOBILE_SHELL)
);

/** True when running the desktop phone-preview harness (dev only). */
export const isMobilePreviewBuild = (): boolean => (
  readTruthyEnv(process.env.NEXT_PUBLIC_MOBILE_PREVIEW)
);

/** True when this bundle is the mobile product shell (Tauri Android/iOS static export or phone preview). */
export const isMobileShellProduct = (): boolean => (
  isMobileShellBuild() || isMobilePreviewBuild()
);

/** True when this bundle is the desktop product shell (Tauri desktop static export). */
export const isDesktopShellProduct = (): boolean => (
  isDesktopShellBuild() && !isMobileShellBuild() && !isMobilePreviewBuild()
);
