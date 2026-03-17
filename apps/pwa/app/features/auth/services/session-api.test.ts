import { beforeEach, describe, expect, it, vi } from "vitest";

const runtimeMocks = vi.hoisted(() => ({
  hasNativeRuntime: vi.fn(),
}));

const adapterMocks = vi.hoisted(() => ({
  invokeNativeCommand: vi.fn(),
}));

vi.mock("@/app/features/runtime/runtime-capabilities", () => ({
  hasNativeRuntime: runtimeMocks.hasNativeRuntime,
}));

vi.mock("@/app/features/runtime/native-adapters", () => ({
  invokeNativeCommand: adapterMocks.invokeNativeCommand,
}));

import { SessionApi } from "./session-api";

describe("SessionApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns inactive session status in unsupported runtimes", async () => {
    runtimeMocks.hasNativeRuntime.mockReturnValue(false);

    await expect(SessionApi.getSessionStatus()).resolves.toEqual({
      isActive: false,
      npub: null,
      isNative: false,
    });
    expect(adapterMocks.invokeNativeCommand).not.toHaveBeenCalled();
  });

  it("returns adapter value when native runtime is available", async () => {
    runtimeMocks.hasNativeRuntime.mockReturnValue(true);
    adapterMocks.invokeNativeCommand.mockResolvedValue({
      ok: true,
      value: {
        isActive: true,
        npub: "npub1test",
        isNative: true,
      },
    });

    await expect(SessionApi.getSessionStatus()).resolves.toEqual({
      isActive: true,
      npub: "npub1test",
      isNative: true,
    });
    expect(adapterMocks.invokeNativeCommand).toHaveBeenCalledWith(
      "get_session_status",
      undefined,
      { timeoutMs: 3_000 }
    );
  });

  it("normalizes snake_case payload from native session status command", async () => {
    runtimeMocks.hasNativeRuntime.mockReturnValue(true);
    adapterMocks.invokeNativeCommand.mockResolvedValueOnce({
      ok: true,
      value: {
        is_active: true,
        npub: "f97456970df92dc0",
        is_native: true,
      },
    });

    await expect(SessionApi.getSessionStatus()).resolves.toEqual({
      isActive: true,
      npub: "f97456970df92dc0",
      isNative: true,
    });
  });

  it("rehydrates status via get_native_npub fallback when session status appears inactive", async () => {
    runtimeMocks.hasNativeRuntime.mockReturnValue(true);
    adapterMocks.invokeNativeCommand
      .mockResolvedValueOnce({
        ok: true,
        value: {
          is_active: false,
          npub: null,
          is_native: true,
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        value: "f97456970df92dc0",
      });

    await expect(SessionApi.getSessionStatus()).resolves.toEqual({
      isActive: true,
      npub: "f97456970df92dc0",
      isNative: true,
    });
    expect(adapterMocks.invokeNativeCommand).toHaveBeenNthCalledWith(
      1,
      "get_session_status",
      undefined,
      { timeoutMs: 3_000 }
    );
    expect(adapterMocks.invokeNativeCommand).toHaveBeenNthCalledWith(
      2,
      "get_native_npub",
      undefined,
      { timeoutMs: 3_000 }
    );
  });

  it("falls back to inactive status when adapter returns failed", async () => {
    runtimeMocks.hasNativeRuntime.mockReturnValue(true);
    adapterMocks.invokeNativeCommand
      .mockResolvedValueOnce({
        ok: false,
        reason: "failed",
        message: "bridge error",
      })
      .mockResolvedValueOnce({
        ok: true,
        value: null,
      });

    await expect(SessionApi.getSessionStatus()).resolves.toEqual({
      isActive: false,
      npub: null,
      isNative: false,
    });
  });
});
