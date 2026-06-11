import { afterEach, describe, expect, it } from "vitest";
import { syncGlobalNavLoadingPaint } from "./global-navigation-loading-paint";

describe("syncGlobalNavLoadingPaint", () => {
  afterEach((): void => {
    document.documentElement.removeAttribute("data-obscur-global-nav-loading");
    document.documentElement.style.removeProperty("--obscur-global-nav-progress");
  });

  it("clears html attributes when navigation progress UX is disabled", () => {
    document.documentElement.setAttribute("data-obscur-global-nav-loading", "active");
    document.documentElement.style.setProperty("--obscur-global-nav-progress", "24%");
    syncGlobalNavLoadingPaint({
      visible: true,
      progress: 24,
      completing: false,
      targetPathname: "/settings",
    });
    expect(document.documentElement.hasAttribute("data-obscur-global-nav-loading")).toBe(false);
    expect(document.documentElement.style.getPropertyValue("--obscur-global-nav-progress")).toBe("");
  });
});
