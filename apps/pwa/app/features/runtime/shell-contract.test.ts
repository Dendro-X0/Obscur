import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isDesktopShellProduct,
  isMobileShellProduct,
} from "./shell-contract";

describe("shell-contract", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("detects mobile shell build flag", () => {
    vi.stubEnv("NEXT_PUBLIC_MOBILE_SHELL", "1");
    vi.stubEnv("NEXT_PUBLIC_DESKTOP_SHELL", "0");
    expect(isMobileShellProduct()).toBe(true);
    expect(isDesktopShellProduct()).toBe(false);
  });

  it("detects desktop shell build flag", () => {
    vi.stubEnv("NEXT_PUBLIC_DESKTOP_SHELL", "1");
    vi.stubEnv("NEXT_PUBLIC_MOBILE_SHELL", "0");
    expect(isDesktopShellProduct()).toBe(true);
    expect(isMobileShellProduct()).toBe(false);
  });
});
