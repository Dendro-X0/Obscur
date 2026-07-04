import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/features/runtime/native-persistence-policy", () => ({
  requiresSqlitePersistence: vi.fn(() => false),
}));

vi.mock("@/app/engine-lab/engine-lab-policy", () => ({
  isEngineLabStrictMode: vi.fn(() => false),
}));

import { isEngineLabStrictMode } from "@/app/engine-lab/engine-lab-policy";
import { requiresSqlitePersistence } from "@/app/features/runtime/native-persistence-policy";
import {
  isTransportKernelPoolHookOwner,
  shouldUseLegacyRelayPoolHook,
} from "./transport-kernel-pool-hook-port";

describe("transport-kernel-pool-hook-port", () => {
  it("uses legacy pool hook on web", () => {
    vi.mocked(isEngineLabStrictMode).mockReturnValue(false);
    vi.mocked(requiresSqlitePersistence).mockReturnValue(false);
    expect(isTransportKernelPoolHookOwner()).toBe(false);
    expect(shouldUseLegacyRelayPoolHook()).toBe(true);
  });

  it("uses transport-kernel pool hook on native authority", () => {
    vi.mocked(isEngineLabStrictMode).mockReturnValue(false);
    vi.mocked(requiresSqlitePersistence).mockReturnValue(true);
    expect(isTransportKernelPoolHookOwner()).toBe(true);
    expect(shouldUseLegacyRelayPoolHook()).toBe(false);
  });
});
