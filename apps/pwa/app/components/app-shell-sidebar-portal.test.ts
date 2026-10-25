import { describe, expect, it } from "vitest";
import { resolveChatSidebarPortalTarget } from "./app-shell-sidebar-portal";

describe("resolveChatSidebarPortalTarget", () => {
  const desktop = { id: "desktop" } as unknown as HTMLElement;
  const mobileDrawer = { id: "mobileDrawer" } as unknown as HTMLElement;

  it("returns null on mobile shell product (inline list owns the node)", () => {
    expect(resolveChatSidebarPortalTarget(
      { desktop, mobileDrawer },
      { isDesktop: true, mobileShellProduct: true },
    )).toBeNull();
  });

  it("prefers the mobile drawer host when it is mounted", () => {
    expect(resolveChatSidebarPortalTarget(
      { desktop, mobileDrawer },
      { isDesktop: true, mobileShellProduct: false },
    )).toBe(mobileDrawer);
  });

  it("uses the desktop host on desktop when the drawer is closed", () => {
    expect(resolveChatSidebarPortalTarget(
      { desktop, mobileDrawer: null },
      { isDesktop: true, mobileShellProduct: false },
    )).toBe(desktop);
  });

  it("returns null on narrow non-desktop when the drawer is closed", () => {
    expect(resolveChatSidebarPortalTarget(
      { desktop, mobileDrawer: null },
      { isDesktop: false, mobileShellProduct: false },
    )).toBeNull();
  });
});
