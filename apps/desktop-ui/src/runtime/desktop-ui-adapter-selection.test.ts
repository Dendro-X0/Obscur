import { describe, expect, it } from "vitest";
import {
  detectDesktopUiNativeRuntime,
  readDesktopUiLabStubsForced,
  resolveDesktopUiAdapterSource,
  shouldUseDesktopUiLabStubs,
} from "./desktop-ui-adapter-selection";

describe("Cut 4.3 desktop-ui adapter selection", () => {
  it("uses lab when stubs forced even if native runtime present", () => {
    expect(shouldUseDesktopUiLabStubs({
      isNativeRuntime: true,
      forceLabStubs: true,
    })).toBe(true);
    expect(resolveDesktopUiAdapterSource({
      isNativeRuntime: true,
      forceLabStubs: true,
    })).toBe("lab");
  });

  it("uses lab when host absent", () => {
    expect(resolveDesktopUiAdapterSource({
      isNativeRuntime: false,
      forceLabStubs: false,
    })).toBe("lab");
  });

  it("prefers native when Tauri present and stubs not forced", () => {
    expect(resolveDesktopUiAdapterSource({
      isNativeRuntime: true,
      forceLabStubs: false,
    })).toBe("native");
  });

  it("reads OBSCUR_DESKTOP_UI_LAB_STUBS", () => {
    expect(readDesktopUiLabStubsForced("1")).toBe(true);
    expect(readDesktopUiLabStubsForced("0")).toBe(false);
    expect(readDesktopUiLabStubsForced(undefined)).toBe(false);
  });

  it("detects Tauri invoke presence", () => {
    expect(detectDesktopUiNativeRuntime(undefined)).toBe(false);
    const fake = {
      __TAURI_INTERNALS__: { invoke: () => undefined },
    } as unknown as Window;
    expect(detectDesktopUiNativeRuntime(fake)).toBe(true);
  });
});
