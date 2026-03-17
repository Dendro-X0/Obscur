import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import { useUserInviteCode } from "./use-user-invite-code";

const mocks = vi.hoisted(() => {
  const profileState = {
    profile: {
      username: "alice",
      about: "",
      avatarUrl: "",
      nip05: "",
      inviteCode: "",
    },
  };
  return {
    profileState,
    setInviteCode: vi.fn(),
    publishProfile: vi.fn(async () => true),
    enabledRelayUrls: ["wss://relay-1.example"],
  };
});

vi.mock("@/app/features/relays/providers/relay-provider", () => ({
  useRelay: () => ({
    enabledRelayUrls: mocks.enabledRelayUrls,
  }),
}));

vi.mock("@/app/features/profile/hooks/use-profile", () => ({
  useProfile: () => ({
    state: mocks.profileState,
    setInviteCode: mocks.setInviteCode,
  }),
}));

vi.mock("@/app/features/profile/hooks/use-profile-publisher", () => ({
  useProfilePublisher: () => ({
    publishProfile: mocks.publishProfile,
  }),
}));

describe("useUserInviteCode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.profileState.profile.inviteCode = "";
  });

  it("normalizes existing profile invite code to uppercase canonical form", async () => {
    mocks.profileState.profile.inviteCode = " obscur-a1b2c ";

    const { result } = renderHook(() => useUserInviteCode({
      publicKeyHex: "a".repeat(64) as PublicKeyHex,
      privateKeyHex: "b".repeat(64) as PrivateKeyHex,
    }));

    await waitFor(() => {
      expect(result.current.inviteCode).toBe("OBSCUR-A1B2C");
    });
    expect(mocks.setInviteCode).toHaveBeenCalledWith({ inviteCode: "OBSCUR-A1B2C" });
  });
});
