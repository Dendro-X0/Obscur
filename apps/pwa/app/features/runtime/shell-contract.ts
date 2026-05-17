/**
 * Build-time shell flags for static export variants (desktop Tauri vs mobile Tauri vs web).
 * Set at compile time via NEXT_PUBLIC_* env; do not infer product shell from CSS breakpoints alone.
 */

export const DESKTOP_SHELL_ENV_KEY = "NEXT_PUBLIC_DESKTOP_SHELL" as const;
export const MOBILE_SHELL_ENV_KEY = "NEXT_PUBLIC_MOBILE_SHELL" as const;

const readTruthyEnv = (value: string | undefined): boolean => (
  value === "1" || value === "true"
);

export const isDesktopShellBuild = (): boolean => (
  readTruthyEnv(process.env[DESKTOP_SHELL_ENV_KEY])
);

export const isMobileShellBuild = (): boolean => (
  readTruthyEnv(process.env[MOBILE_SHELL_ENV_KEY])
);

/** True when this bundle is the mobile product shell (Tauri Android/iOS static export). */
export const isMobileShellProduct = (): boolean => isMobileShellBuild();

/** True when this bundle is the desktop product shell (Tauri desktop static export). */
export const isDesktopShellProduct = (): boolean => (
  isDesktopShellBuild() && !isMobileShellBuild()
);
