import { beforeEach, describe, expect, it } from "vitest";
import { ProfileRegistryService, profileRegistryServiceInternals } from "./profile-registry-service";

describe("profile-registry-service", () => {
  beforeEach(() => {
    localStorage.clear();
    profileRegistryServiceInternals.resetForTests();
  });

  it("creates default state with one active default profile", () => {
    const state = ProfileRegistryService.getState();
    expect(state.activeProfileId).toBe("default");
    expect(state.profiles).toHaveLength(1);
    expect(state.profiles[0]?.status).toBe("active");
  });

  it("creates and switches to a new profile", () => {
    const created = ProfileRegistryService.createProfile("Work");
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const targetId = created.value.profiles.find((profile) => profile.label === "Work")?.profileId;
    expect(targetId).toBeTruthy();

    const switched = ProfileRegistryService.switchProfile(targetId!);
    expect(switched.ok).toBe(true);
    if (!switched.ok) return;

    expect(switched.value.activeProfileId).toBe(targetId);
    expect(switched.value.profiles.find((profile) => profile.profileId === targetId)?.status).toBe("active");
  });

  it("prevents removing default profile", () => {
    const removed = ProfileRegistryService.removeProfile("default");
    expect(removed.ok).toBe(false);
  });

  it("rejects switching to unknown profile", () => {
    const switched = ProfileRegistryService.switchProfile("missing-profile");
    expect(switched.ok).toBe(false);
  });
});
