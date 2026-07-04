import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/features/runtime/native-persistence-policy", () => ({
  requiresSqlitePersistence: vi.fn(() => false),
}));

vi.mock("@/app/engine-lab/engine-lab-policy", () => ({
  isEngineLabStrictMode: vi.fn(() => false),
}));

import { isEngineLabStrictMode } from "@/app/engine-lab/engine-lab-policy";
import { requiresSqlitePersistence } from "@/app/features/runtime/native-persistence-policy";
import { isTransportKernelAuthority } from "./transport-kernel-policy";

describe("transport-kernel policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isEngineLabStrictMode).mockReturnValue(false);
    vi.mocked(requiresSqlitePersistence).mockReturnValue(false);
  });

  it("is active on native runtime by default", () => {
    vi.mocked(requiresSqlitePersistence).mockReturnValue(true);
    expect(isTransportKernelAuthority()).toBe(true);
  });

  it("is inactive on web when not in engine lab strict mode", () => {
    expect(isTransportKernelAuthority()).toBe(false);
  });

  it("is active in engine lab strict mode on web", () => {
    vi.mocked(isEngineLabStrictMode).mockReturnValue(true);
    expect(isTransportKernelAuthority()).toBe(true);
  });
});
