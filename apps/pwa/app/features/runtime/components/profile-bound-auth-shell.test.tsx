import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PROFILE_BOOT_STALL_TIMEOUT_MS_WEB } from "@/app/features/runtime/services/profile-boot-stall-policy";
import { ProfileBoundAuthShell } from "./profile-bound-auth-shell";

const profileBoundAuthShellMocks = vi.hoisted(() => ({
  identity: {
    state: {
      status: "loading" as const,
      stored: undefined as { publicKeyHex: string } | undefined,
    },
  },
  runtime: {
    snapshot: {
      phase: "fatal",
      lastError: "This profile was imported without a local password." as string | undefined,
      session: {
        identityStatus: "locked",
        startupState: {
          kind: "stored_locked",
          message: undefined as string | undefined,
        },
      },
    },
    lockBoundProfile: vi.fn(),
    refreshWindowBinding: vi.fn(),
  },
}));

vi.mock("@/app/features/auth/hooks/use-identity", () => ({
  useIdentity: () => profileBoundAuthShellMocks.identity,
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
    profileBoundAuthShellMocks.identity.state.status = "loading";
    profileBoundAuthShellMocks.identity.state.stored = undefined;
    profileBoundAuthShellMocks.runtime.snapshot.phase = "fatal";
    profileBoundAuthShellMocks.runtime.snapshot.lastError = "This profile was imported without a local password.";
    profileBoundAuthShellMocks.runtime.snapshot.session.identityStatus = "locked";
    profileBoundAuthShellMocks.runtime.snapshot.session.startupState.kind = "stored_locked";
    profileBoundAuthShellMocks.runtime.snapshot.session.startupState.message = undefined;
  });

  it("shows a recovery button in fatal phase and returns user to login flow", () => {
    profileBoundAuthShellMocks.runtime.snapshot.session.startupState.kind = "fatal_storage_error";
    profileBoundAuthShellMocks.runtime.snapshot.session.startupState.message = "This profile was imported without a local password.";

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

  it("keeps auth screen mounted when profile rebinding flickers after auth was shown", () => {
    profileBoundAuthShellMocks.runtime.snapshot.phase = "auth_required";
    profileBoundAuthShellMocks.runtime.snapshot.lastError = undefined;
    profileBoundAuthShellMocks.runtime.snapshot.session.identityStatus = "locked";
    profileBoundAuthShellMocks.runtime.snapshot.session.startupState.kind = "no_identity";

    const view = render(<ProfileBoundAuthShell />);
    expect(screen.getByText("Auth Screen")).toBeInTheDocument();

    profileBoundAuthShellMocks.runtime.snapshot.phase = "binding_profile";
    profileBoundAuthShellMocks.runtime.snapshot.session.identityStatus = "loading";
    profileBoundAuthShellMocks.runtime.snapshot.session.startupState.kind = "pending";
    view.rerender(<ProfileBoundAuthShell />);

    expect(screen.getByText("Auth Screen")).toBeInTheDocument();
    expect(screen.queryByAltText("Loading")).not.toBeInTheDocument();
  });

  it("fails open to login recovery when profile boot stalls", async () => {
    vi.useFakeTimers();
    profileBoundAuthShellMocks.runtime.snapshot.phase = "binding_profile";
    profileBoundAuthShellMocks.runtime.snapshot.lastError = undefined;
    profileBoundAuthShellMocks.runtime.snapshot.session.identityStatus = "loading";
    profileBoundAuthShellMocks.runtime.snapshot.session.startupState.kind = "pending";
    profileBoundAuthShellMocks.runtime.snapshot.session.startupState.message = undefined;

    render(<ProfileBoundAuthShell />);
    await act(async () => {
      vi.advanceTimersByTime(PROFILE_BOOT_STALL_TIMEOUT_MS_WEB + 100);
    });

    expect(screen.getByText("Profile startup is taking longer than expected.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue to Login" }));
    expect(profileBoundAuthShellMocks.runtime.lockBoundProfile).toHaveBeenCalledTimes(1);
  });

  it("restarts the stall wait window when retry binding is clicked", async () => {
    vi.useFakeTimers();
    profileBoundAuthShellMocks.runtime.snapshot.phase = "binding_profile";
    profileBoundAuthShellMocks.runtime.snapshot.lastError = undefined;
    profileBoundAuthShellMocks.runtime.snapshot.session.identityStatus = "loading";
    profileBoundAuthShellMocks.runtime.snapshot.session.startupState.kind = "pending";

    render(<ProfileBoundAuthShell />);
    await act(async () => {
      vi.advanceTimersByTime(PROFILE_BOOT_STALL_TIMEOUT_MS_WEB + 100);
    });
    expect(screen.getByText("Profile startup is taking longer than expected.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry Binding" }));
    expect(screen.queryByText("Profile startup is taking longer than expected.")).not.toBeInTheDocument();
    expect(profileBoundAuthShellMocks.runtime.refreshWindowBinding).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(PROFILE_BOOT_STALL_TIMEOUT_MS_WEB + 100);
    });
    expect(screen.getByText("Profile startup is taking longer than expected.")).toBeInTheDocument();
  });

  it("shows auth screen while identity bootstrap knows a stored key is present", () => {
    profileBoundAuthShellMocks.runtime.snapshot.phase = "binding_profile";
    profileBoundAuthShellMocks.runtime.snapshot.lastError = undefined;
    profileBoundAuthShellMocks.runtime.snapshot.session.identityStatus = "loading";
    profileBoundAuthShellMocks.runtime.snapshot.session.startupState = {
      kind: "pending",
      storedPublicKeyHex: "abc",
    } as unknown as typeof profileBoundAuthShellMocks.runtime.snapshot.session.startupState;
    profileBoundAuthShellMocks.identity.state.status = "loading";

    render(<ProfileBoundAuthShell />);

    expect(screen.getByText("Auth Screen")).toBeInTheDocument();
    expect(screen.queryByAltText("Loading")).not.toBeInTheDocument();
  });
});
