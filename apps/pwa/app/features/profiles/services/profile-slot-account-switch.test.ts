import { beforeEach, describe, expect, it, vi } from "vitest";
import { openFreshProfileWindowForSignIn } from "./profile-slot-account-switch";
import { desktopProfileRuntime } from "./desktop-profile-runtime";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";

vi.mock("@/app/features/runtime/runtime-capabilities", () => ({
  hasNativeRuntime: vi.fn(() => false),
}));

vi.mock("./desktop-profile-runtime", () => ({
  desktopProfileRuntime: {
    getSnapshot: vi.fn(() => ({
      profiles: [{ profileId: "default", label: "Default" }],
    })),
    createProfile: vi.fn(async (label: string) => ({
      profiles: [
        { profileId: "default", label: "Default" },
        { profileId: "demo-user", label },
      ],
    })),
    openProfileWindow: vi.fn(async () => undefined),
  },
}));

describe("openFreshProfileWindowForSignIn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("registers the profile in native runtime before opening a window", async () => {
    vi.mocked(hasNativeRuntime).mockReturnValue(true);

    const profileId = await openFreshProfileWindowForSignIn("Demo capture");

    expect(desktopProfileRuntime.createProfile).toHaveBeenCalledWith("Demo capture");
    expect(desktopProfileRuntime.openProfileWindow).toHaveBeenCalledWith("demo-user");
    expect(profileId).toBe("demo-user");
  });

  it("falls back to local registry when native runtime is unavailable", async () => {
    vi.mocked(hasNativeRuntime).mockReturnValue(false);

    const profileId = await openFreshProfileWindowForSignIn("Web profile");

    expect(desktopProfileRuntime.createProfile).not.toHaveBeenCalled();
    expect(desktopProfileRuntime.openProfileWindow).not.toHaveBeenCalled();
    expect(profileId).toBe("web-profile");
  });
});
