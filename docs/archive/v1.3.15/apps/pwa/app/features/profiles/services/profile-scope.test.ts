import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getActiveProfileId: vi.fn(),
}));

vi.mock("./profile-registry-service", () => ({
  ProfileRegistryService: {
    getActiveProfileId: mocks.getActiveProfileId,
  },
}));

import {
  getActiveProfileIdSafe,
  getScopedStorageKey,
  setProfileScopeOverride,
} from "./profile-scope";

describe("profile-scope", () => {
  beforeEach(() => {
    mocks.getActiveProfileId.mockReturnValue("default");
    setProfileScopeOverride(null);
  });

  it("uses the explicit window-bound profile override when present", () => {
    setProfileScopeOverride("profile-b");

    expect(getActiveProfileIdSafe()).toBe("profile-b");
    expect(getScopedStorageKey("obscur.test")).toBe("obscur.test::profile-b");
  });

  it("falls back to the registry active profile when no override is set", () => {
    mocks.getActiveProfileId.mockReturnValue("profile-a");

    expect(getActiveProfileIdSafe()).toBe("profile-a");
    expect(getScopedStorageKey("obscur.test")).toBe("obscur.test::profile-a");
  });
});
