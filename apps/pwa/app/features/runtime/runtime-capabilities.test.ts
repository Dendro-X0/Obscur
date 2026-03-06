import { beforeEach, describe, expect, it } from "vitest";
import { getRuntimeCapabilities } from "./runtime-capabilities";

describe("runtime-capabilities", () => {
  beforeEach(() => {
    const w = window as Window & {
      __TAURI__?: unknown;
      __TAURI_INTERNALS__?: unknown;
      __TAURI_IPC__?: unknown;
    };
    delete w.__TAURI__;
    delete w.__TAURI_INTERNALS__;
    delete w.__TAURI_IPC__;
  });

  it("returns non-native capabilities by default in web", () => {
    const caps = getRuntimeCapabilities();
    expect(caps.isNativeRuntime).toBe(false);
    expect(caps.supportsWindowControls).toBe(false);
  });

  it("detects desktop-native runtime with callable bridge", () => {
    const w = window as Window & { __TAURI_INTERNALS__?: { invoke?: unknown } };
    w.__TAURI_INTERNALS__ = { invoke: () => undefined };

    const caps = getRuntimeCapabilities();
    expect(caps.isNativeRuntime).toBe(true);
    expect(caps.isDesktop).toBe(true);
    expect(caps.supportsWindowControls).toBe(true);
  });

  it("does not treat mere tauri markers without invoke as native", () => {
    const w = window as Window & { __TAURI__?: unknown };
    w.__TAURI__ = {};

    const caps = getRuntimeCapabilities();
    expect(caps.isNativeRuntime).toBe(false);
  });
});
