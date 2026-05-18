/** Monorepo release version injected at static build time (see scripts/build-pwa-shell.mjs). */
export const APP_VERSION: string = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

export const formatAppVersionLabel = (version: string = APP_VERSION): string => (
  version === "dev" ? "dev" : version.replace(/^v/i, "")
);
