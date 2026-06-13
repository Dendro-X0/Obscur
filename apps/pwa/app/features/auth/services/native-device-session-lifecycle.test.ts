import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearInMemoryNativeSessionBestEffort,
  endNativeDeviceSignInBestEffort,
  NATIVE_DEVICE_SIGN_IN_ENDED_EVENT,
  NATIVE_SESSION_LOCKED_EVENT,
} from "./native-device-session-lifecycle";

const nativeRuntime = vi.hoisted(() => ({
  isNative: true,
}));

const cryptoMocks = vi.hoisted(() => ({
  clearNativeSession: vi.fn(async () => undefined),
  deleteNativeKey: vi.fn(async () => undefined),
}));

vi.mock("@/app/features/runtime/runtime-capabilities", () => ({
  hasNativeRuntime: () => nativeRuntime.isNative,
}));

vi.mock("@/app/features/crypto/crypto-service", () => ({
  cryptoService: cryptoMocks,
}));

vi.mock("@/app/shared/log-app-event", () => ({
  logAppEvent: vi.fn(),
}));

import { logAppEvent } from "@/app/shared/log-app-event";

describe("native-device-session-lifecycle", () => {
  beforeEach(() => {
    nativeRuntime.isNative = true;
    cryptoMocks.clearNativeSession.mockClear();
    cryptoMocks.deleteNativeKey.mockClear();
    vi.mocked(logAppEvent).mockClear();
  });

  it("lock path clears in-memory session only", async () => {
    await clearInMemoryNativeSessionBestEffort();

    expect(cryptoMocks.clearNativeSession).toHaveBeenCalledTimes(1);
    expect(cryptoMocks.deleteNativeKey).not.toHaveBeenCalled();
    expect(logAppEvent).toHaveBeenCalledWith(expect.objectContaining({
      name: NATIVE_SESSION_LOCKED_EVENT,
      level: "info",
    }));
  });

  it("sign-out path deletes keychain via logout_native", async () => {
    await endNativeDeviceSignInBestEffort();

    expect(cryptoMocks.deleteNativeKey).toHaveBeenCalledTimes(1);
    expect(cryptoMocks.clearNativeSession).not.toHaveBeenCalled();
    expect(logAppEvent).toHaveBeenCalledWith(expect.objectContaining({
      name: NATIVE_DEVICE_SIGN_IN_ENDED_EVENT,
      level: "info",
    }));
  });

  it("no-ops on non-native runtimes", async () => {
    nativeRuntime.isNative = false;

    await clearInMemoryNativeSessionBestEffort();
    await endNativeDeviceSignInBestEffort();

    expect(cryptoMocks.clearNativeSession).not.toHaveBeenCalled();
    expect(cryptoMocks.deleteNativeKey).not.toHaveBeenCalled();
  });
});
