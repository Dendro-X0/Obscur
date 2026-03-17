import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getRuntimeCapabilities,
  getRuntimeShellInfo,
  runtimeCapabilitiesInternals,
} from "./runtime-capabilities";

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

  it("classifies local dev host for shared runtime policy", () => {
    const host = runtimeCapabilitiesInternals.classifyRuntimeHost("127.0.0.1");
    expect(host.isLocalDevelopment).toBe(true);
    expect(host.isHostedPreview).toBe(false);
  });

  it("classifies hosted preview for shared runtime policy", () => {
    const host = runtimeCapabilitiesInternals.classifyRuntimeHost("obscur-preview.vercel.app");
    expect(host.isHostedPreview).toBe(true);
    expect(host.isLocalDevelopment).toBe(false);
  });

  it("detects standalone pwa shell state", () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;

    expect(getRuntimeShellInfo().isStandalonePwa).toBe(true);

    window.matchMedia = originalMatchMedia;
  });
});
