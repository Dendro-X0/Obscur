import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StartupExperienceOverlay } from "./startup-experience-overlay";

const startupOverlayMocks = vi.hoisted(() => ({
  runtimeSnapshot: {
    phase: "activating_runtime",
    session: {
      identityStatus: "unlocked",
      profileLabel: "Default",
      profileId: "default",
    },
    relayRuntime: {
      phase: "connecting",
      writableRelayCount: 0,
    },
  } as {
    phase: string;
    session: {
      identityStatus: string;
      profileLabel: string;
      profileId: string;
    };
    relayRuntime: {
      phase: string;
      writableRelayCount: number;
    };
  },
  accountSyncSnapshot: {
    phase: "restoring_account_data",
    message: "Restoring account data",
  } as {
    phase: string;
    message: string;
  },
  projectionSnapshot: {
    phase: "bootstrapping",
    accountProjectionReady: false,
  } as {
    phase: string;
    accountProjectionReady: boolean;
  },
}));

vi.mock("@/app/features/runtime/services/window-runtime-supervisor", () => ({
  useWindowRuntime: () => ({
    snapshot: startupOverlayMocks.runtimeSnapshot,
  }),
}));

vi.mock("@/app/features/account-sync/hooks/use-account-sync-snapshot", () => ({
  useAccountSyncSnapshot: () => startupOverlayMocks.accountSyncSnapshot,
}));

vi.mock("@/app/features/account-sync/hooks/use-account-projection-snapshot", () => ({
  useAccountProjectionSnapshot: () => startupOverlayMocks.projectionSnapshot,
}));

describe("StartupExperienceOverlay", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    startupOverlayMocks.runtimeSnapshot.phase = "activating_runtime";
    startupOverlayMocks.runtimeSnapshot.session.identityStatus = "unlocked";
    startupOverlayMocks.runtimeSnapshot.relayRuntime.phase = "connecting";
    startupOverlayMocks.runtimeSnapshot.relayRuntime.writableRelayCount = 0;
    startupOverlayMocks.accountSyncSnapshot.phase = "restoring_account_data";
    startupOverlayMocks.accountSyncSnapshot.message = "Restoring account data";
    startupOverlayMocks.projectionSnapshot.phase = "bootstrapping";
    startupOverlayMocks.projectionSnapshot.accountProjectionReady = false;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders global startup progress while startup is incomplete", () => {
    render(<StartupExperienceOverlay />);

    expect(screen.getByText("Preparing your workspace")).toBeInTheDocument();
    expect(screen.getByText("Identity & Profile")).toBeInTheDocument();
    expect(screen.getByText("Relay Connection")).toBeInTheDocument();
  });

  it("does not render when runtime is in auth required phase", () => {
    startupOverlayMocks.runtimeSnapshot.phase = "auth_required";
    startupOverlayMocks.runtimeSnapshot.session.identityStatus = "locked";

    render(<StartupExperienceOverlay />);

    expect(screen.queryByText("Preparing your workspace")).not.toBeInTheDocument();
  });

  it("does not re-open after runtime activation has settled", () => {
    startupOverlayMocks.runtimeSnapshot.phase = "ready";
    startupOverlayMocks.runtimeSnapshot.session.identityStatus = "unlocked";
    startupOverlayMocks.accountSyncSnapshot.phase = "restoring_account_data";
    startupOverlayMocks.projectionSnapshot.phase = "bootstrapping";

    render(<StartupExperienceOverlay />);

    expect(screen.queryByText("Preparing your workspace")).not.toBeInTheDocument();
  });

  it("does not render when startup overlay has already been shown in this session", () => {
    window.sessionStorage.setItem("obscur.runtime.startup_overlay_seen.v1", "1");

    render(<StartupExperienceOverlay />);

    expect(screen.queryByText("Preparing your workspace")).not.toBeInTheDocument();
  });

  it("shows bypass button after prolonged startup transition", () => {
    vi.useFakeTimers();

    render(<StartupExperienceOverlay />);
    expect(screen.queryByRole("button", { name: "Continue" })).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(10_500);
    });

    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
  });
});
