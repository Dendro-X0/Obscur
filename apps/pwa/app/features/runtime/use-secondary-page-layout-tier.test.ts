import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getMobileCompactLayoutSnapshot,
  getMobileThreadCompactCardsSnapshot,
  getSecondaryPageLayoutTierSnapshot,
  getTabletSecondaryLayoutSnapshot,
} from "./use-secondary-page-layout-tier.snapshot";

const shellMocks = vi.hoisted(() => ({
  isDesktopShellProduct: false,
  isMobileShellProduct: true,
  phone: false,
  tablet: false,
}));

vi.mock("@/app/features/runtime/shell-contract", () => ({
  isDesktopShellProduct: () => shellMocks.isDesktopShellProduct,
  isMobileShellProduct: () => shellMocks.isMobileShellProduct,
}));

const matchMedia = (phone: boolean, tablet: boolean): void => {
  shellMocks.phone = phone;
  shellMocks.tablet = tablet;
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches:
      (query.includes("max-width: 639px") && phone)
      || (query.includes("min-width: 640px") && query.includes("max-width: 1023px") && tablet),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
};

describe("secondary page layout tier snapshots", () => {
  beforeEach(() => {
    shellMocks.isDesktopShellProduct = false;
    shellMocks.isMobileShellProduct = true;
    matchMedia(false, false);
  });

  it("uses phone tier on narrow mobile shell viewports", () => {
    matchMedia(true, false);
    expect(getSecondaryPageLayoutTierSnapshot()).toBe("phone");
    expect(getMobileCompactLayoutSnapshot()).toBe(true);
    expect(getTabletSecondaryLayoutSnapshot()).toBe(false);
    expect(getMobileThreadCompactCardsSnapshot()).toBe(true);
  });

  it("uses tablet tier on iPad-width mobile shell viewports", () => {
    matchMedia(false, true);
    expect(getSecondaryPageLayoutTierSnapshot()).toBe("tablet");
    expect(getMobileCompactLayoutSnapshot()).toBe(false);
    expect(getTabletSecondaryLayoutSnapshot()).toBe(true);
    expect(getMobileThreadCompactCardsSnapshot()).toBe(false);
  });

  it("uses desktop tier on wide viewports", () => {
    matchMedia(false, false);
    expect(getSecondaryPageLayoutTierSnapshot()).toBe("desktop");
    expect(getMobileCompactLayoutSnapshot()).toBe(false);
  });

  it("forces desktop tier on desktop shell builds", () => {
    shellMocks.isDesktopShellProduct = true;
    matchMedia(true, true);
    expect(getSecondaryPageLayoutTierSnapshot()).toBe("desktop");
    expect(getMobileCompactLayoutSnapshot()).toBe(false);
  });
});
