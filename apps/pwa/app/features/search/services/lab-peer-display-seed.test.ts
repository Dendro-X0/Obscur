import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/features/runtime/experiment-shell-policy", () => ({
  isExperimentOnlineEnabled: vi.fn(() => true),
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

vi.mock("@/app/features/profiles/services/desktop-profile-preview-enrichment", () => ({
  buildAccountDisplayHintsByPublicKey: vi.fn(() => new Map()),
}));

vi.mock("./peer-display-local-hint-seed", () => ({
  seedPeerDisplayFromLocalAccountHintsSync: vi.fn(() => 0),
}));

vi.mock("./device-peer-display-cache", () => ({
  upsertDevicePeerDisplay: vi.fn(async () => true),
}));

import { isExperimentOnlineEnabled } from "@/app/features/runtime/experiment-shell-policy";
import { seedProfileMetadataCache } from "@/app/features/profile/hooks/use-profile-metadata";
import { discoveryCache } from "./discovery-cache";
import { upsertDevicePeerDisplay } from "./device-peer-display-cache";
import { resolvedIdentityCache } from "./resolved-identity-cache";
import {
  labPeerDisplaySeedInternals,
  seedLabPeerDisplayHintsIfNeeded,
} from "./lab-peer-display-seed";

describe("lab-peer-display-seed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isExperimentOnlineEnabled).mockReturnValue(true);
    vi.mocked(discoveryCache.getProfile).mockReturnValue(null);
    vi.mocked(resolvedIdentityCache.getByPubkey).mockReturnValue(null);
  });

  it("no-ops when experiment-online is off", () => {
    vi.mocked(isExperimentOnlineEnabled).mockReturnValue(false);
    expect(seedLabPeerDisplayHintsIfNeeded()).toBe(0);
    expect(discoveryCache.upsertProfile).not.toHaveBeenCalled();
  });

  it("seeds Tester2 discovery + resolved labels under experiment-online", () => {
    const seeded = seedLabPeerDisplayHintsIfNeeded();
    expect(seeded).toBeGreaterThan(0);
    const tester2 = labPeerDisplaySeedInternals.LAB_PEER_DISPLAY_HINTS[1];
    expect(discoveryCache.upsertProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        pubkey: tester2.pubkey,
        displayName: "Tester2",
        picture: tester2.avatarUrl,
      }),
    );
    expect(resolvedIdentityCache.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        pubkey: tester2.pubkey,
        display: "Tester2",
      }),
    );
    expect(seedProfileMetadataCache).toHaveBeenCalledWith(
      expect.objectContaining({
        pubkey: tester2.pubkey,
        displayName: "Tester2",
        avatarUrl: tester2.avatarUrl,
      }),
    );
    expect(upsertDevicePeerDisplay).toHaveBeenCalledWith(
      expect.objectContaining({
        pubkey: tester2.pubkey,
        displayName: "Tester2",
        avatarUrl: tester2.avatarUrl,
      }),
    );
  });
});
