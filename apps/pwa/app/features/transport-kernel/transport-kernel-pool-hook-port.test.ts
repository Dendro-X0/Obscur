import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/features/runtime/native-persistence-policy", () => ({
  requiresSqlitePersistence: vi.fn(() => false),
}));

vi.mock("@/app/engine-lab/engine-lab-policy", () => ({
  isEngineLabStrictMode: vi.fn(() => false),
}));

vi.mock("@/app/features/runtime/runtime-capabilities", () => ({
  hasNativeRuntime: vi.fn(() => false),
}));

import { isEngineLabStrictMode } from "@/app/engine-lab/engine-lab-policy";
import { requiresSqlitePersistence } from "@/app/features/runtime/native-persistence-policy";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import {
  isTransportKernelPoolHookOwner,
  shouldUseLegacyRelayPoolHook,
} from "./transport-kernel-pool-hook-port";

describe("transport-kernel-pool-hook-port", () => {
  it("RUST-4c: never uses legacy pool hook on web (mesh owns UI)", () => {
    vi.mocked(isEngineLabStrictMode).mockReturnValue(false);
    vi.mocked(requiresSqlitePersistence).mockReturnValue(false);
    vi.mocked(hasNativeRuntime).mockReturnValue(false);
    expect(isTransportKernelPoolHookOwner()).toBe(false);
    expect(shouldUseLegacyRelayPoolHook()).toBe(false);
  });

  it("uses transport-kernel pool hook on native authority", () => {
    vi.mocked(isEngineLabStrictMode).mockReturnValue(false);
    vi.mocked(requiresSqlitePersistence).mockReturnValue(true);
    vi.mocked(hasNativeRuntime).mockReturnValue(true);
    expect(isTransportKernelPoolHookOwner()).toBe(true);
    expect(shouldUseLegacyRelayPoolHook()).toBe(false);
  });

  it("RUST-4c: never uses legacy pool hook on native", () => {
    vi.mocked(isEngineLabStrictMode).mockReturnValue(false);
    vi.mocked(requiresSqlitePersistence).mockReturnValue(false);
    vi.mocked(hasNativeRuntime).mockReturnValue(true);
    expect(shouldUseLegacyRelayPoolHook()).toBe(false);
  });
});
