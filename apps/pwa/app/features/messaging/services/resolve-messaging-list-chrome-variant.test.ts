import { afterEach, describe, expect, it, vi } from "vitest";

describe("resolveMessagingListChromeVariant", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("uses desktop chrome on desktop shell product", async () => {
    vi.stubEnv("NEXT_PUBLIC_DESKTOP_SHELL", "1");
    vi.stubEnv("NEXT_PUBLIC_MOBILE_SHELL", "0");
    vi.stubEnv("NEXT_PUBLIC_MOBILE_PREVIEW", "0");
    const { resolveMessagingListChromeVariant } = await import("./resolve-messaging-list-chrome-variant");
    expect(resolveMessagingListChromeVariant()).toBe("desktop");
  });

  it("uses mobile chrome on mobile shell / preview", async () => {
    vi.stubEnv("NEXT_PUBLIC_DESKTOP_SHELL", "0");
    vi.stubEnv("NEXT_PUBLIC_MOBILE_SHELL", "1");
    vi.stubEnv("NEXT_PUBLIC_MOBILE_PREVIEW", "0");
    const { resolveMessagingListChromeVariant } = await import("./resolve-messaging-list-chrome-variant");
    expect(resolveMessagingListChromeVariant()).toBe("mobile");
  });
});
