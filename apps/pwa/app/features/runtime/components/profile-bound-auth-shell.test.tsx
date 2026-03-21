import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileBoundAuthShell } from "./profile-bound-auth-shell";

const profileBoundAuthShellMocks = vi.hoisted(() => ({
  runtime: {
    snapshot: {
      phase: "fatal",
      lastError: "This profile was imported without a local password." as string | undefined,
      session: {
        identityStatus: "locked",
      },
    },
    lockBoundProfile: vi.fn(),
    refreshWindowBinding: vi.fn(),
  },
}));

vi.mock("@/app/features/runtime/services/window-runtime-supervisor", () => ({
  useWindowRuntime: () => profileBoundAuthShellMocks.runtime,
}));

vi.mock("@/app/features/auth/components/auth-screen", () => ({
  AuthScreen: () => <div>Auth Screen</div>,
}));

describe("ProfileBoundAuthShell", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    profileBoundAuthShellMocks.runtime.snapshot.phase = "fatal";
    profileBoundAuthShellMocks.runtime.snapshot.lastError = "This profile was imported without a local password.";
    profileBoundAuthShellMocks.runtime.snapshot.session.identityStatus = "locked";
  });

  it("shows a recovery button in fatal phase and returns user to login flow", () => {
    render(<ProfileBoundAuthShell />);

    expect(screen.getByText("This profile was imported without a local password.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back to Login" }));
    expect(profileBoundAuthShellMocks.runtime.lockBoundProfile).toHaveBeenCalledTimes(1);
  });

  it("keeps auth screen mounted during unlocking phase", () => {
    profileBoundAuthShellMocks.runtime.snapshot.phase = "unlocking";
    profileBoundAuthShellMocks.runtime.snapshot.lastError = undefined;

    render(<ProfileBoundAuthShell />);

    expect(screen.getByText("Auth Screen")).toBeInTheDocument();
    expect(screen.queryByText("Unlocking profile runtime...")).not.toBeInTheDocument();
  });

  it("fails open to login recovery when profile boot stalls", async () => {
    vi.useFakeTimers();
    profileBoundAuthShellMocks.runtime.snapshot.phase = "binding_profile";
    profileBoundAuthShellMocks.runtime.snapshot.lastError = undefined;
    profileBoundAuthShellMocks.runtime.snapshot.session.identityStatus = "loading";

    render(<ProfileBoundAuthShell />);
    await act(async () => {
      vi.advanceTimersByTime(12_100);
    });

    expect(screen.getByText("Profile startup is taking longer than expected.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Keep Waiting" }));
    expect(profileBoundAuthShellMocks.runtime.refreshWindowBinding).toHaveBeenCalledTimes(1);
    expect(profileBoundAuthShellMocks.runtime.lockBoundProfile).not.toHaveBeenCalled();
  });
});
