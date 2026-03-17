import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileBoundAuthShell } from "./profile-bound-auth-shell";

const profileBoundAuthShellMocks = vi.hoisted(() => ({
  runtime: {
    snapshot: {
      phase: "fatal",
      lastError: "This profile was imported without a local password." as string | undefined,
    },
    lockBoundProfile: vi.fn(),
  },
}));

vi.mock("@/app/features/runtime/services/window-runtime-supervisor", () => ({
  useWindowRuntime: () => profileBoundAuthShellMocks.runtime,
}));

vi.mock("@/app/features/auth/components/auth-screen", () => ({
  AuthScreen: () => <div>Auth Screen</div>,
}));

describe("ProfileBoundAuthShell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    profileBoundAuthShellMocks.runtime.snapshot.phase = "fatal";
    profileBoundAuthShellMocks.runtime.snapshot.lastError = "This profile was imported without a local password.";
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
});
