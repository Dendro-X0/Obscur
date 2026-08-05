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
  it("never selects browser-pool standalone EVENT publish (web harness included)", () => {
    vi.mocked(isEngineLabStrictMode).mockReturnValue(false);
    vi.mocked(requiresSqlitePersistence).mockReturnValue(false);
    vi.mocked(hasNativeRuntime).mockReturnValue(false);
    expect(isTransportKernelPublishOwner()).toBe(false);
    expect(shouldUseLegacyStandaloneRelayPublish()).toBe(false);
  });

  it("uses transport-kernel publish on native authority", () => {
    vi.mocked(isEngineLabStrictMode).mockReturnValue(false);
    vi.mocked(requiresSqlitePersistence).mockReturnValue(true);
    vi.mocked(hasNativeRuntime).mockReturnValue(true);
    expect(isTransportKernelPublishOwner()).toBe(true);
    expect(shouldUseLegacyStandaloneRelayPublish()).toBe(false);
  });

  it("quarantines legacy pool publish on native even without transport-kernel authority", () => {
    vi.stubEnv("NEXT_PUBLIC_OBSCUR_TRANSPORT_KERNEL", "0");
    vi.mocked(isEngineLabStrictMode).mockReturnValue(false);
    vi.mocked(requiresSqlitePersistence).mockReturnValue(true);
    vi.mocked(hasNativeRuntime).mockReturnValue(true);
    expect(isTransportKernelPublishOwner()).toBe(false);
    expect(shouldUseLegacyStandaloneRelayPublish()).toBe(false);
    vi.unstubAllEnvs();
  });

  it("does not claim publish ownership in strict mode without native runtime", () => {
    vi.mocked(isEngineLabStrictMode).mockReturnValue(true);
    vi.mocked(requiresSqlitePersistence).mockReturnValue(false);
    vi.mocked(hasNativeRuntime).mockReturnValue(false);
    expect(isTransportKernelPublishOwner()).toBe(false);
    expect(shouldUseLegacyStandaloneRelayPublish()).toBe(false);
  });

  it("keeps host publish shim off without lab env opt-in", () => {
    vi.mocked(isEngineLabStrictMode).mockReturnValue(true);
    vi.mocked(requiresSqlitePersistence).mockReturnValue(true);
    vi.mocked(hasNativeRuntime).mockReturnValue(true);
    expect(shouldUseHostTransportPublishShim()).toBe(false);
  });

  it("tombstones host publish shim even with env opt-in (Dev Lab disabled)", () => {
    vi.stubEnv("NEXT_PUBLIC_OBSCUR_TRANSPORT_HOST_PUBLISH_SHIM", "1");
    vi.mocked(isEngineLabStrictMode).mockReturnValue(true);
    vi.mocked(requiresSqlitePersistence).mockReturnValue(true);
    vi.mocked(hasNativeRuntime).mockReturnValue(true);
    expect(shouldUseHostTransportPublishShim()).toBe(false);
    expect(shouldRouteHostTransportPublish()).toBe(false);
    vi.unstubAllEnvs();
  });

  it("keeps authority gate off without maintainer env opt-in", () => {
    vi.mocked(isEngineLabStrictMode).mockReturnValue(true);
    vi.mocked(requiresSqlitePersistence).mockReturnValue(true);
    vi.mocked(hasNativeRuntime).mockReturnValue(true);
    expect(shouldUseHostTransportPublishAuthority()).toBe(false);
  });

  it("tombstones host authority routing even with env opt-in (Dev Lab disabled)", () => {
    vi.stubEnv("NEXT_PUBLIC_OBSCUR_TRANSPORT_HOST_PUBLISH_AUTHORITY", "1");
    vi.mocked(isEngineLabStrictMode).mockReturnValue(true);
    vi.mocked(requiresSqlitePersistence).mockReturnValue(true);
    vi.mocked(hasNativeRuntime).mockReturnValue(true);
    expect(shouldUseHostTransportPublishAuthority()).toBe(false);
    expect(shouldRouteHostTransportPublish()).toBe(false);
    vi.unstubAllEnvs();
  });
});

