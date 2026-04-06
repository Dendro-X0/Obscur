import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PwaServiceWorkerRegistrar from "./pwa-service-worker-registrar";

const runtimeMocks = vi.hoisted(() => ({
  hasNativeRuntime: vi.fn(() => false),
}));

vi.mock("@/app/features/runtime/runtime-capabilities", () => ({
  hasNativeRuntime: runtimeMocks.hasNativeRuntime,
}));

const defineServiceWorker = (value: unknown): void => {
  Object.defineProperty(window.navigator, "serviceWorker", {
    configurable: true,
    writable: true,
    value,
  });
};

describe("PwaServiceWorkerRegistrar", () => {
  beforeEach(() => {
    runtimeMocks.hasNativeRuntime.mockReturnValue(false);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    cleanup();
    vi.restoreAllMocks();
  });

  it("registers /sw.js in production web runtime", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const register = vi.fn(() => Promise.resolve({}));
    defineServiceWorker({
      register,
      getRegistrations: vi.fn(() => Promise.resolve([])),
    });

    render(<PwaServiceWorkerRegistrar />);

    await waitFor(() => {
      expect(register).toHaveBeenCalledWith("/sw.js");
    });
  });

  it("unregisters existing workers in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const unregister = vi.fn(() => Promise.resolve(true));
    const getRegistrations = vi.fn(() => Promise.resolve([{ unregister }]));
    defineServiceWorker({
      register: vi.fn(() => Promise.resolve({})),
      getRegistrations,
    });

    render(<PwaServiceWorkerRegistrar />);

    await waitFor(() => {
      expect(getRegistrations).toHaveBeenCalled();
      expect(unregister).toHaveBeenCalled();
    });
  });

  it("skips service worker setup in native runtime", async () => {
    vi.stubEnv("NODE_ENV", "production");
    runtimeMocks.hasNativeRuntime.mockReturnValue(true);
    const register = vi.fn(() => Promise.resolve({}));
    const getRegistrations = vi.fn(() => Promise.resolve([]));
    defineServiceWorker({
      register,
      getRegistrations,
    });

    render(<PwaServiceWorkerRegistrar />);
    await Promise.resolve();

    expect(register).not.toHaveBeenCalled();
    expect(getRegistrations).not.toHaveBeenCalled();
  });
});
