/**
 * Shell health probes — detect fatal error boundaries and missing chrome.
 */

export type DevLabShellHealth = Readonly<{
  version: "obscur.dev-lab.shell-health.v1";
  checkedAtUnixMs: number;
  healthy: boolean;
  shellUnlocked: boolean;
  rootFatalBoundary: boolean;
  settingsTabBoundary: boolean;
  issues: ReadonlyArray<string>;
  fatalBoundaryMessage: string | null;
}>;

declare global {
  interface Window {
    __OBSCUR_FATAL_BOUNDARY__?: Readonly<{
      active: boolean;
      message?: string;
      stack?: string;
      atUnixMs?: number;
    }>;
  }
}

const ROOT_BOUNDARY_TEST_ID = "root-error-boundary";
const SETTINGS_TAB_BOUNDARY_PREFIX = "settings-tab-error-";

const hasSidebarShellMarker = (): boolean => {
  if (typeof document === "undefined") {
    return false;
  }
  // Playwright headless may not compute layout; DOM presence is enough for dev-lab probes.
  for (const label of ["Settings", "Network", "Search", "Chats"]) {
    if (document.querySelector(`a[aria-label="${label}"]`)) {
      return true;
    }
  }
  return false;
};

const hasSettingsShellMarker = (): boolean => {
  if (typeof document === "undefined") {
    return false;
  }
  const path = window.location?.pathname ?? "";
  if (!path.startsWith("/settings")) {
    return false;
  }
  return Boolean(
    document.querySelector("[data-settings-tab]")
    || document.querySelector('[data-testid^="settings-tab-panel-"]')
    || document.querySelector("#settings-tab-panel-relays"),
  );
};

const hasUnlockedShellMarker = (): boolean => (
  hasSidebarShellMarker() || hasSettingsShellMarker()
);

const hasRootFatalBoundaryDom = (): boolean => {
  if (typeof document === "undefined") {
    return false;
  }
  if (document.querySelector(`[data-testid="${ROOT_BOUNDARY_TEST_ID}"]`)) {
    return true;
  }
  const heading = document.querySelector("h1");
  if (heading?.textContent?.includes("Oops! Something went wrong")) {
    return true;
  }
  return false;
};

const hasSettingsTabBoundaryDom = (): boolean => {
  if (typeof document === "undefined") {
    return false;
  }
  return Boolean(document.querySelector(`[data-testid^="${SETTINGS_TAB_BOUNDARY_PREFIX}"]`));
};

export const probeDevLabShellHealth = (): DevLabShellHealth => {
  const rootFatalBoundary = (
    window.__OBSCUR_FATAL_BOUNDARY__?.active === true
    || hasRootFatalBoundaryDom()
  );
  const settingsTabBoundary = hasSettingsTabBoundaryDom();
  const shellUnlocked = hasUnlockedShellMarker() && !rootFatalBoundary;

  const issues: string[] = [];
  if (rootFatalBoundary) {
    issues.push("root_fatal_error_boundary");
  }
  if (settingsTabBoundary) {
    issues.push("settings_tab_error_boundary");
  }
  if (!shellUnlocked && !rootFatalBoundary) {
    issues.push("shell_not_unlocked");
  }

  const fatalBoundaryMessage = rootFatalBoundary
    ? (window.__OBSCUR_FATAL_BOUNDARY__?.message
      ?? document.querySelector(`[data-testid="${ROOT_BOUNDARY_TEST_ID}"]`)?.textContent?.slice(0, 500)
      ?? "Root error boundary active")
    : null;

  return {
    version: "obscur.dev-lab.shell-health.v1",
    checkedAtUnixMs: Date.now(),
    healthy: issues.length === 0,
    shellUnlocked,
    rootFatalBoundary,
    settingsTabBoundary,
    issues,
    fatalBoundaryMessage,
  };
};

export const devLabShellHealthInternals = {
  ROOT_BOUNDARY_TEST_ID,
  SETTINGS_TAB_BOUNDARY_PREFIX,
  hasSidebarShellMarker,
  hasSettingsShellMarker,
  hasUnlockedShellMarker,
  hasRootFatalBoundaryDom,
};
