import { afterEach, describe, expect, it, vi } from "vitest";

const runtimeMocks = vi.hoisted(() => ({
  hasNativeRuntime: vi.fn(),
}));

const serviceMocks = vi.hoisted(() => ({
  nativeInstance: { kind: "native" },
  browserInstance: { kind: "browser" },
}));

vi.mock("@/app/features/runtime/runtime-capabilities", () => ({
  hasNativeRuntime: runtimeMocks.hasNativeRuntime,
}));

vi.mock("../native-crypto-service", () => ({
  NativeCryptoService: vi.fn(class NativeCryptoServiceMock {
    constructor() {
      return serviceMocks.nativeInstance;
    }
  }),
  NATIVE_KEY_SENTINEL: "native",
}));

vi.mock("../crypto-service-impl", () => ({
  CryptoServiceImpl: vi.fn(class CryptoServiceImplMock {
    constructor() {
      return serviceMocks.browserInstance;
    }
  }),
}));

vi.mock("comlink", () => ({
  wrap: vi.fn((worker: unknown) => worker),
}));

describe("crypto-service runtime selection", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("prefers native crypto service when runtime is native", async () => {
    runtimeMocks.hasNativeRuntime.mockReturnValue(true);

    const cryptoServiceModule = await import("../crypto-service");

    expect(cryptoServiceModule.cryptoServiceInternals.initializeCryptoService()).toBe(serviceMocks.nativeInstance);
  });

  it("falls back to main-thread crypto service when worker is unavailable", async () => {
    runtimeMocks.hasNativeRuntime.mockReturnValue(false);

    const originalWorker = globalThis.Worker;
    vi.stubGlobal("Worker", undefined);

    const cryptoServiceModule = await import("../crypto-service");

    expect(cryptoServiceModule.cryptoServiceInternals.initializeCryptoService()).toBe(serviceMocks.browserInstance);

    vi.stubGlobal("Worker", originalWorker);
  });
});
