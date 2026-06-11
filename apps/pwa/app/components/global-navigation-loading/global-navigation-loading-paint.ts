import type { GlobalNavLoadingRenderState } from "./global-navigation-loading-state";

const HTML_ATTR = "data-obscur-global-nav-loading";
const PROGRESS_VAR = "--obscur-global-nav-progress";

/** Imperative top bar (disabled while navigation progress UX is off). */
export const syncGlobalNavLoadingPaint = (state: GlobalNavLoadingRenderState): void => {
  if (typeof document === "undefined") {
    return;
  }
  const root = document.documentElement;
  root.removeAttribute(HTML_ATTR);
  root.style.removeProperty(PROGRESS_VAR);
};
