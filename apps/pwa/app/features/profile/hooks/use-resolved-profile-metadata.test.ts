import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  useProfileMetadata: vi.fn(),
  useProfile: vi.fn(),
  useIdentity: vi.fn(),
}));

vi.mock("./use-profile-metadata", () => ({
  useProfileMetadata: mocks.useProfileMetadata,
}));

vi.mock("@/app/features/profile/hooks/use-profile", () => ({
  useProfile: mocks.useProfile,
}));

vi.mock("@/app/features/auth/hooks/use-identity", () => ({
  useIdentity: mocks.useIdentity,
}));

import { useResolvedProfileMetadata } from "./use-resolved-profile-metadata";

describe("useResolvedProfileMetadata", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useIdentity.mockReturnValue({
      state: {
        publicKeyHex: "self-pubkey",
        stored: null,
      },
    });
    mocks.useProfile.mockReturnValue({
      state: {
        profile: {
          username: "Local Self",
          about: "Local about",
          avatarUrl: "/uploads/self-avatar.png",
          nip05: "self@example.com",
          inviteCode: "",
        },
      },
    });
  });

  it("falls back to locally persisted self profile data", () => {
    mocks.useProfileMetadata.mockReturnValue(null);

    const { result } = renderHook(() => useResolvedProfileMetadata("self-pubkey"));

    expect(result.current.isSelf).toBe(true);
    expect(result.current.displayName).toBe("Local Self");
    expect(result.current.avatarUrl).toBe(`${window.location.origin}/uploads/self-avatar.png`);
    expect(result.current.about).toBe("Local about");
    expect(result.current.nip05).toBe("self@example.com");
  });

  it("prefers resolved metadata for remote peers", () => {
    mocks.useProfileMetadata.mockReturnValue({
      pubkey: "peer-pubkey",
      displayName: "Remote Peer",
      avatarUrl: "https://cdn.example.com/peer.png",
      about: "Remote about",
      nip05: "peer@example.com",
    });

    const { result } = renderHook(() => useResolvedProfileMetadata("peer-pubkey"));

    expect(result.current.isSelf).toBe(false);
    expect(result.current.displayName).toBe("Remote Peer");
    expect(result.current.avatarUrl).toBe("https://cdn.example.com/peer.png");
    expect(result.current.about).toBe("Remote about");
    expect(result.current.nip05).toBe("peer@example.com");
  });
});
