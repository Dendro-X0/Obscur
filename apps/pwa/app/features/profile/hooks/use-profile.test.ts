import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import {
  ProfileRegistryService,
  profileRegistryServiceInternals,
} from "@/app/features/profiles/services/profile-registry-service";
import { useProfile, useProfileInternals } from "./use-profile";

describe("useProfile restart recovery", () => {
  beforeEach(() => {
    localStorage.clear();
    profileRegistryServiceInternals.resetForTests();
    useProfileInternals.resetForTests();
    ProfileRegistryService.switchProfile("default");
  });

  it("restores persisted local profile state after a restart-style reset", async () => {
    const { result, unmount } = renderHook(() => useProfile());

    act(() => {
      result.current.setUsername({ username: "Alice" });
      result.current.setAbout({ about: "Builder" });
      result.current.setAvatarUrl({ avatarUrl: "/uploads/alice.png" });
      result.current.setNip05({ nip05: "alice@example.com" });
      result.current.setInviteCode({ inviteCode: "OBSCUR-ALICE9" });
      result.current.save();
    });

    const defaultKey = useProfileInternals.getStorageKey();
    expect(localStorage.getItem(defaultKey)).toContain("Alice");

    unmount();
    useProfileInternals.resetForTests();

    const restarted = renderHook(() => useProfile());

    await waitFor(() => {
      expect(restarted.result.current.state.profile.username).toBe("Alice");
    });
    expect(restarted.result.current.state.profile.about).toBe("Builder");
    expect(restarted.result.current.state.profile.avatarUrl).toBe(`${window.location.origin}/uploads/alice.png`);
    expect(restarted.result.current.state.profile.nip05).toBe("alice@example.com");
    expect(restarted.result.current.state.profile.inviteCode).toBe("OBSCUR-ALICE9");
  });

  it("keeps local profile state isolated per active profile across switches", async () => {
    const { result } = renderHook(() => useProfile());
    const defaultKey = useProfileInternals.getStorageKey();

    act(() => {
      result.current.setUsername({ username: "Default Alice" });
      result.current.setAbout({ about: "Default profile" });
      result.current.setInviteCode({ inviteCode: "OBSCUR-DEFAULT" });
      result.current.save();
    });

    let created!: ReturnType<typeof ProfileRegistryService.createProfile>;
    act(() => {
      created = ProfileRegistryService.createProfile("Work");
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const workId = created.value.profiles.find((profile) => profile.label === "Work")?.profileId;
    expect(workId).toBeTruthy();
    if (!workId) return;

    act(() => {
      ProfileRegistryService.switchProfile(workId);
    });

    await waitFor(() => {
      expect(result.current.state.profile.username).toBe("");
    });

    act(() => {
      result.current.setUsername({ username: "Work Bob" });
      result.current.setAbout({ about: "Work profile" });
      result.current.setInviteCode({ inviteCode: "OBSCUR-WORK77" });
      result.current.save();
    });

    const workKey = useProfileInternals.getStorageKey();
    expect(workKey).not.toBe(defaultKey);
    expect(localStorage.getItem(workKey)).toContain("Work Bob");

    act(() => {
      ProfileRegistryService.switchProfile("default");
    });

    await waitFor(() => {
      expect(result.current.state.profile.username).toBe("Default Alice");
    });
    expect(result.current.state.profile.about).toBe("Default profile");
    expect(result.current.state.profile.inviteCode).toBe("OBSCUR-DEFAULT");

    act(() => {
      ProfileRegistryService.switchProfile(workId);
    });

    await waitFor(() => {
      expect(result.current.state.profile.username).toBe("Work Bob");
    });
    expect(result.current.state.profile.about).toBe("Work profile");
    expect(result.current.state.profile.inviteCode).toBe("OBSCUR-WORK77");
  });
});
