import { afterEach, describe, expect, it, vi } from "vitest";

const fixtureLoaders = {
  eager: () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("./fixture-sidebar-route-client");
  },
  lazy: () => import("./fixture-sidebar-route-client"),
};

describe("createSidebarRoutePage", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("returns an eager page factory on production desktop shell builds", async () => {
    vi.stubEnv("NEXT_PUBLIC_DESKTOP_SHELL", "1");
    vi.stubEnv("NEXT_PUBLIC_MOBILE_SHELL", "0");
    vi.stubEnv("NODE_ENV", "production");
    const { createSidebarRoutePage } = await import("./create-sidebar-route-page");
    const Page = createSidebarRoutePage(fixtureLoaders, {
      title: "Loading",
      detail: "Please wait",
    });
    expect(Page.name).toBe("EagerSidebarRoutePage");
  });

  it("returns a lazy page factory on dev desktop shell builds", async () => {
    vi.stubEnv("NEXT_PUBLIC_DESKTOP_SHELL", "1");
    vi.stubEnv("NEXT_PUBLIC_MOBILE_SHELL", "0");
    vi.stubEnv("NODE_ENV", "development");
    const { createSidebarRoutePage } = await import("./create-sidebar-route-page");
    const Page = createSidebarRoutePage(fixtureLoaders, {
      title: "Loading",
      detail: "Please wait",
    });
    expect(Page.name).toBe("LazySidebarRoutePage");
  });

  it("returns a lazy page factory on non-desktop builds", async () => {
    vi.stubEnv("NEXT_PUBLIC_DESKTOP_SHELL", "0");
    vi.stubEnv("NEXT_PUBLIC_MOBILE_SHELL", "0");
    const { createSidebarRoutePage } = await import("./create-sidebar-route-page");
    const Page = createSidebarRoutePage(fixtureLoaders, {
      title: "Loading",
      detail: "Please wait",
    });
    expect(Page.name).toBe("LazySidebarRoutePage");
  });
});
