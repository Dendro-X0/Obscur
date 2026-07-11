import { afterEach, describe, expect, it, vi } from "vitest";

describe("offline-runtime-policy", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("skips relay network bootstrap when browser is offline", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    vi.doMock("@/app/features/runtime/native-persistence-policy", () => ({
      requiresSqlitePersistence: () => false,
    }));
    const { shouldSkipRelayNetworkBootstrap } = await import("./offline-runtime-policy");
    expect(shouldSkipRelayNetworkBootstrap()).toBe(true);
  });

  it("runs relay network bootstrap on native persistence when online", async () => {
    vi.stubGlobal("navigator", { onLine: true });
    vi.doMock("@/app/features/runtime/native-persistence-policy", () => ({
      requiresSqlitePersistence: () => true,
    }));
    const { shouldSkipRelayNetworkBootstrap } = await import("./offline-runtime-policy");
    expect(shouldSkipRelayNetworkBootstrap()).toBe(false);
  });

  it("treats transport publish as unavailable when offline or no writable relays", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const { isTransportPublishAvailable } = await import("./offline-runtime-policy");
    expect(isTransportPublishAvailable(3)).toBe(false);
    vi.stubGlobal("navigator", { onLine: true });
    expect(isTransportPublishAvailable(0)).toBe(false);
    expect(isTransportPublishAvailable(2)).toBe(true);
  });
});
