import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/features/runtime/runtime-capabilities", () => ({
  hasNativeRuntime: vi.fn(() => false),
}));

vi.mock("@/app/features/profile/hooks/use-profile-metadata", () => ({
  seedProfileMetadataCache: vi.fn(),
}));

vi.mock("./discovery-cache", () => ({
  discoveryCache: {
    getProfile: vi.fn(() => null),
    upsertProfile: vi.fn(),
  },
}));

vi.mock("./resolved-identity-cache", () => ({
  resolvedIdentityCache: {
    getByPubkey: vi.fn(() => null),
    upsert: vi.fn(),
  },
}));

import { seedProfileMetadataCache } from "@/app/features/profile/hooks/use-profile-metadata";
import { discoveryCache } from "./discovery-cache";
import { resolvedIdentityCache } from "./resolved-identity-cache";
import {
  devicePeerDisplayCacheInternals,
  hydrateRuntimeFromDevicePeerDisplayCache,
  upsertDevicePeerDisplay,
} from "./device-peer-display-cache";

const TESTER2 =
  "3db055b47e05bdfb9083efec0b7aecd2a045dbf7d865cf4d95d98817d946830f";

describe("device-peer-display-cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(discoveryCache.getProfile).mockReturnValue(null);
    vi.mocked(resolvedIdentityCache.getByPubkey).mockReturnValue(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(devicePeerDisplayCacheInternals.BROWSER_FALLBACK_KEY);
    }
  });

  it("upserts name+avatar into browser fallback and runtime caches", async () => {
    const ok = await upsertDevicePeerDisplay({
      pubkey: TESTER2,
      displayName: "Tester2",
      avatarUrl: "https://cdn.example/tester2.png",
    });
    expect(ok).toBe(true);
    expect(discoveryCache.upsertProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        pubkey: TESTER2,
        displayName: "Tester2",
        picture: "https://cdn.example/tester2.png",
      }),
    );
    expect(seedProfileMetadataCache).toHaveBeenCalledWith(
      expect.objectContaining({
        pubkey: TESTER2,
        displayName: "Tester2",
        avatarUrl: "https://cdn.example/tester2.png",
      }),
    );
  });

  it("hydrates runtime caches from persisted browser fallback", async () => {
    await upsertDevicePeerDisplay({
      pubkey: TESTER2,
      displayName: "Tester2",
      avatarUrl: "https://cdn.example/tester2.png",
    });
    vi.clearAllMocks();
    vi.mocked(discoveryCache.getProfile).mockReturnValue(null);

    const applied = await hydrateRuntimeFromDevicePeerDisplayCache();
    expect(applied).toBe(1);
    expect(discoveryCache.upsertProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        pubkey: TESTER2,
        picture: "https://cdn.example/tester2.png",
      }),
    );
  });

  it("merges avatar onto existing discovery name without wiping about", async () => {
    vi.mocked(discoveryCache.getProfile).mockReturnValue({
      pubkey: TESTER2,
      displayName: "Tester2",
      about: "keep-me",
      updatedAtUnixMs: 1,
    });
    devicePeerDisplayCacheInternals.applyEntryToRuntimeCaches({
      pubkey: TESTER2,
      avatarUrl: "https://cdn.example/tester2.png",
      updatedAtUnixMs: Date.now(),
    });
    expect(discoveryCache.upsertProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        pubkey: TESTER2,
        displayName: "Tester2",
        picture: "https://cdn.example/tester2.png",
        about: "keep-me",
      }),
    );
  });
});
