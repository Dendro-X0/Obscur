import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearOrphanProfileSlotWorkspace } from "./profile-slot-greenfield-workspace-prep";

vi.mock("./profile-slot-login-guard", () => ({
  getProfileSlotOccupantPublicKeyHex: vi.fn(),
}));

vi.mock("./wipe-profile-workspace", () => ({
  wipeProfileWorkspaceCompletely: vi.fn(async () => ({
    profileId: "default",
    publicKeyHex: null,
    localReset: { tier: "complete" },
  })),
}));

import { getProfileSlotOccupantPublicKeyHex } from "./profile-slot-login-guard";
import { wipeProfileWorkspaceCompletely } from "./wipe-profile-workspace";

describe("clearOrphanProfileSlotWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getProfileSlotOccupantPublicKeyHex).mockReturnValue(null);
  });

  it("wipes workspace when the slot has no bound account", async () => {
    await clearOrphanProfileSlotWorkspace("default");

    expect(wipeProfileWorkspaceCompletely).toHaveBeenCalledWith({
      profileId: "default",
      publicKeyHex: null,
    });
  });

  it("skips wipe when the slot already has an account occupant", async () => {
    vi.mocked(getProfileSlotOccupantPublicKeyHex).mockReturnValue(
      "a".repeat(64) as import("@dweb/crypto/public-key-hex").PublicKeyHex,
    );

    await clearOrphanProfileSlotWorkspace("default");

    expect(wipeProfileWorkspaceCompletely).not.toHaveBeenCalled();
  });
});
