import { afterEach, describe, expect, it, vi } from "vitest";
import { shouldPrewarmDevWebpackNavigationOnBoot } from "./sidebar-navigation-policy";

describe("shouldPrewarmDevWebpackNavigationOnBoot", () => {
  afterEach((): void => {
    vi.unstubAllEnvs();
  });

  it("is true for dev desktop online webpack", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_DESKTOP_SHELL", "1");
    vi.stubEnv("NEXT_PUBLIC_OBSCUR_EXPERIMENT_ONLINE", "1");
    expect(shouldPrewarmDevWebpackNavigationOnBoot()).toBe(true);
  });

  it("is false for production desktop builds", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_DESKTOP_SHELL", "1");
    vi.stubEnv("NEXT_PUBLIC_OBSCUR_EXPERIMENT_ONLINE", "1");
    expect(shouldPrewarmDevWebpackNavigationOnBoot()).toBe(false);
  });
});
