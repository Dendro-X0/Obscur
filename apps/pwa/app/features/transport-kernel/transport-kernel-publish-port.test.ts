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
  isTransportKernelPublishOwner,
  shouldRouteHostTransportPublish,
  shouldUseHostTransportPublishAuthority,
  shouldUseHostTransportPublishShim,
  shouldUseLegacyStandaloneRelayPublish,
} from "./transport-kernel-publish-port";

describe("transport-kernel-publish-port", () => {
  it("uses legacy publish on web", () => {
    vi.mocked(isEngineLabStrictMode).mockReturnValue(false);
    vi.mocked(requiresSqlitePersistence).mockReturnValue(false);
    vi.mocked(hasNativeRuntime).mockReturnValue(false);
    expect(isTransportKernelPublishOwner()).toBe(false);
    expect(shouldUseLegacyStandaloneRelayPublish()).toBe(true);
  });

  it("uses transport-kernel publish on native authority", () => {
    vi.mocked(isEngineLabStrictMode).mockReturnValue(false);
    vi.mocked(requiresSqlitePersistence).mockReturnValue(true);
    vi.mocked(hasNativeRuntime).mockReturnValue(true);
    expect(isTransportKernelPublishOwner()).toBe(true);
    expect(shouldUseLegacyStandaloneRelayPublish()).toBe(false);
  });

  it("does not claim publish ownership in strict mode without native runtime", () => {
    vi.mocked(isEngineLabStrictMode).mockReturnValue(true);
    vi.mocked(requiresSqlitePersistence).mockReturnValue(false);
    vi.mocked(hasNativeRuntime).mockReturnValue(false);
    expect(isTransportKernelPublishOwner()).toBe(false);
    expect(shouldUseLegacyStandaloneRelayPublish()).toBe(true);
  });

  it("keeps host publish shim off without lab env opt-in", () => {
    vi.mocked(isEngineLabStrictMode).mockReturnValue(true);
    vi.mocked(requiresSqlitePersistence).mockReturnValue(true);
    vi.mocked(hasNativeRuntime).mockReturnValue(true);
    expect(shouldUseHostTransportPublishShim()).toBe(false);
  });

  it("enables host publish shim only with engine-lab strict mode, native owner, and env opt-in", () => {
    vi.stubEnv("NEXT_PUBLIC_OBSCUR_TRANSPORT_HOST_PUBLISH_SHIM", "1");
    vi.mocked(isEngineLabStrictMode).mockReturnValue(true);
    vi.mocked(requiresSqlitePersistence).mockReturnValue(true);
    vi.mocked(hasNativeRuntime).mockReturnValue(true);
    expect(shouldUseHostTransportPublishShim()).toBe(true);
    vi.unstubAllEnvs();
  });

  it("keeps authority gate off without maintainer env opt-in", () => {
    vi.mocked(isEngineLabStrictMode).mockReturnValue(true);
    vi.mocked(requiresSqlitePersistence).mockReturnValue(true);
    vi.mocked(hasNativeRuntime).mockReturnValue(true);
    expect(shouldUseHostTransportPublishAuthority()).toBe(false);
  });

  it("combines authority and shim gates for host routing", () => {
    vi.stubEnv("NEXT_PUBLIC_OBSCUR_TRANSPORT_HOST_PUBLISH_AUTHORITY", "1");
    vi.mocked(isEngineLabStrictMode).mockReturnValue(true);
    vi.mocked(requiresSqlitePersistence).mockReturnValue(true);
    vi.mocked(hasNativeRuntime).mockReturnValue(true);
    expect(shouldRouteHostTransportPublish()).toBe(true);
    vi.unstubAllEnvs();
  });
});

