import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  greenfieldAuthWindowLabel,
  requiresFreshProfileWindowForGreenfieldAuth,
} from "./profile-slot-greenfield-auth-routing";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { profileSlotHasLocalAccountData } from "./profile-slot-login-guard";

vi.mock("@/app/features/runtime/runtime-capabilities", () => ({
  hasNativeRuntime: vi.fn(() => false),
}));

vi.mock("./profile-slot-login-guard", () => ({
  profileSlotHasLocalAccountData: vi.fn(() => false),
}));

describe("profile-slot-greenfield-auth-routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not require a new window on web", () => {
    vi.mocked(hasNativeRuntime).mockReturnValue(false);
    vi.mocked(profileSlotHasLocalAccountData).mockReturnValue(true);
    expect(requiresFreshProfileWindowForGreenfieldAuth("default")).toBe(false);
  });

  it("requires a new window on desktop when the slot already has account data", () => {
    vi.mocked(hasNativeRuntime).mockReturnValue(true);
    vi.mocked(profileSlotHasLocalAccountData).mockReturnValue(true);
    expect(requiresFreshProfileWindowForGreenfieldAuth("default")).toBe(true);
  });

  it("allows in-window create/restore on desktop when the slot is empty", () => {
    vi.mocked(hasNativeRuntime).mockReturnValue(true);
    vi.mocked(profileSlotHasLocalAccountData).mockReturnValue(false);
    expect(requiresFreshProfileWindowForGreenfieldAuth("default")).toBe(false);
  });

  it("maps greenfield intents to profile window labels", () => {
    expect(greenfieldAuthWindowLabel("create")).toBe("New identity");
    expect(greenfieldAuthWindowLabel("restore")).toBe("Restore backup");
  });
});
