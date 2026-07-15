import { afterEach, describe, expect, it, vi } from "vitest";

import {
  isConduitMeshPoolExplicitlyDisabled,
  isConduitMeshPoolHookOwner,
  shouldUseConduitMeshRelayPoolHook,
} from "./conduit-mesh-pool-hook-port";
import { isTransportKernelPoolHookOwner } from "./transport-kernel-pool-hook-port";

describe("conduit-mesh-pool-hook-port", () => {
  const env = process.env;

  afterEach(() => {
    process.env = { ...env };
    vi.unstubAllEnvs();
  });

  it("is default-on under transport-kernel pool ownership (C7b)", () => {
    vi.stubEnv("NEXT_PUBLIC_OBSCUR_CONDUIT_MESH_POOL", "");
    vi.stubEnv("NEXT_PUBLIC_OBSCUR_ALLOW_LEGACY", "0");
    if (isTransportKernelPoolHookOwner()) {
      expect(isConduitMeshPoolHookOwner()).toBe(true);
      expect(shouldUseConduitMeshRelayPoolHook()).toBe(true);
    }
  });

  it("opts out when CONDUIT_MESH_POOL=0", () => {
    vi.stubEnv("NEXT_PUBLIC_OBSCUR_CONDUIT_MESH_POOL", "0");
    vi.stubEnv("NEXT_PUBLIC_OBSCUR_ALLOW_LEGACY", "0");
    expect(isConduitMeshPoolExplicitlyDisabled()).toBe(true);
    expect(isConduitMeshPoolHookOwner()).toBe(false);
    expect(shouldUseConduitMeshRelayPoolHook()).toBe(false);
  });

  it("remains active when CONDUIT_MESH_POOL=1 (explicit compat)", () => {
    vi.stubEnv("NEXT_PUBLIC_OBSCUR_CONDUIT_MESH_POOL", "1");
    vi.stubEnv("NEXT_PUBLIC_OBSCUR_ALLOW_LEGACY", "0");
    if (isTransportKernelPoolHookOwner()) {
      expect(isConduitMeshPoolHookOwner()).toBe(true);
    }
  });
});
