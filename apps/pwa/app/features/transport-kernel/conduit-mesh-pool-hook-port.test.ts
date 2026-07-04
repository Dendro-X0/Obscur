import { afterEach, describe, expect, it, vi } from "vitest";

import {
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

  it("is inactive without CONDUIT_MESH_POOL flag", () => {
    vi.stubEnv("NEXT_PUBLIC_OBSCUR_CONDUIT_MESH_POOL", "");
    expect(isConduitMeshPoolHookOwner()).toBe(false);
    expect(shouldUseConduitMeshRelayPoolHook()).toBe(false);
  });

  it("is active when mesh pool flag and transport kernel owner", () => {
    vi.stubEnv("NEXT_PUBLIC_OBSCUR_CONDUIT_MESH_POOL", "1");
    vi.stubEnv("NEXT_PUBLIC_OBSCUR_ALLOW_LEGACY", "0");
    if (isTransportKernelPoolHookOwner()) {
      expect(isConduitMeshPoolHookOwner()).toBe(true);
    }
  });
});
