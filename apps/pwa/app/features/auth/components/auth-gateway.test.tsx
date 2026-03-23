import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthGateway } from "./auth-gateway";
import { logAppEvent } from "@/app/shared/log-app-event";

const authGatewayMocks = vi.hoisted(() => ({
  identityState: {
    status: "locked",
    stored: {
      publicKeyHex: "a".repeat(64),
    },
  } as {
    status: "loading" | "locked" | "unlocked" | "error";
    stored?: Readonly<{ publicKeyHex: string }>;
  },
  retryNativeSessionUnlock: vi.fn(async () => false),
  runtime: {
    snapshot: {
      phase: "auth_required",
      session: {
        profileId: "default",
      },
    },
    unlockBoundProfile: vi.fn(),
  } as {
    snapshot: {
      phase: string;
      session: { profileId: string };
    };
    unlockBoundProfile: ReturnType<typeof vi.fn>;
  },
}));

vi.mock("@/app/features/auth/hooks/use-identity", () => ({
  useIdentity: () => ({
    state: authGatewayMocks.identityState,
    retryNativeSessionUnlock: authGatewayMocks.retryNativeSessionUnlock,
  }),
}));

vi.mock("@/app/features/runtime/services/window-runtime-supervisor", () => ({
  useWindowRuntime: () => authGatewayMocks.runtime,
}));

vi.mock("@/app/features/runtime/components/profile-bound-auth-shell", () => ({
  ProfileBoundAuthShell: () => <div>Profile Bound Auth Shell</div>,
}));

vi.mock("@/app/features/auth/utils/auth-storage-keys", () => ({
  getRememberMeStorageKeyCandidates: ({ profileId }: { profileId: string }) => [
    `remember::${profileId}`,
    "remember::legacy",
  ],
  getAuthTokenStorageKeyCandidates: ({ profileId }: { profileId: string }) => [
    `token::${profileId}`,
    "token::legacy",
  ],
}));

vi.mock("@/app/shared/log-app-event", () => ({
  logAppEvent: vi.fn(),
}));

describe("AuthGateway", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    authGatewayMocks.identityState.status = "locked";
    authGatewayMocks.identityState.stored = {
      publicKeyHex: "a".repeat(64),
    };
    authGatewayMocks.retryNativeSessionUnlock.mockResolvedValue(false);
    authGatewayMocks.runtime.snapshot.phase = "auth_required";
    authGatewayMocks.runtime.snapshot.session.profileId = "default";
    authGatewayMocks.runtime.unlockBoundProfile.mockResolvedValue(undefined);
  });

  it("waits for auth_required and retries auto-unlock when profile binding changes", async () => {
    localStorage.setItem("remember::bound-profile", "true");
    localStorage.setItem("token::bound-profile", "correct-passphrase");
    authGatewayMocks.runtime.snapshot.phase = "binding_profile";
    authGatewayMocks.runtime.snapshot.session.profileId = "default";

    const view = render(
      <AuthGateway>
        <div>Runtime Children</div>
      </AuthGateway>,
    );

    await waitFor(() => {
      expect(authGatewayMocks.runtime.unlockBoundProfile).not.toHaveBeenCalled();
    });
    expect(screen.getByText("Profile Bound Auth Shell")).toBeInTheDocument();

    authGatewayMocks.runtime.snapshot.phase = "auth_required";
    authGatewayMocks.runtime.snapshot.session.profileId = "bound-profile";
    view.rerender(
      <AuthGateway>
        <div>Runtime Children</div>
      </AuthGateway>,
    );

    await waitFor(() => {
      expect(authGatewayMocks.runtime.unlockBoundProfile).toHaveBeenCalledTimes(1);
    });
    expect(authGatewayMocks.runtime.unlockBoundProfile).toHaveBeenCalledWith({
      passphrase: "correct-passphrase",
    });
  });

  it("tries all token candidates before failing auto-unlock", async () => {
    localStorage.setItem("remember::default", "true");
    localStorage.setItem("token::default", "stale-passphrase");
    localStorage.setItem("token::legacy", "fresh-passphrase");
    authGatewayMocks.runtime.unlockBoundProfile.mockImplementation(async (params: { passphrase: string }) => {
      if (params.passphrase === "fresh-passphrase") {
        return;
      }
      throw new Error("unlock_failed");
    });

    render(
      <AuthGateway>
        <div>Runtime Children</div>
      </AuthGateway>,
    );

    await waitFor(() => {
      expect(authGatewayMocks.runtime.unlockBoundProfile).toHaveBeenCalledTimes(2);
    });
    expect(authGatewayMocks.runtime.unlockBoundProfile).toHaveBeenNthCalledWith(1, {
      passphrase: "stale-passphrase",
    });
    expect(authGatewayMocks.runtime.unlockBoundProfile).toHaveBeenNthCalledWith(2, {
      passphrase: "fresh-passphrase",
    });
    expect(localStorage.getItem("remember::default")).toBe("true");
    expect(localStorage.getItem("token::legacy")).toBe("fresh-passphrase");
  });

  it("preserves remembered credentials when all token candidates fail", async () => {
    localStorage.setItem("remember::default", "true");
    localStorage.setItem("remember::legacy", "true");
    localStorage.setItem("token::default", "bad-1");
    localStorage.setItem("token::legacy", "bad-2");
    authGatewayMocks.runtime.unlockBoundProfile.mockRejectedValue(new Error("unlock_failed"));

    render(
      <AuthGateway>
        <div>Runtime Children</div>
      </AuthGateway>,
    );

    await waitFor(() => {
      expect(authGatewayMocks.runtime.unlockBoundProfile).toHaveBeenCalledTimes(2);
    });
    expect(localStorage.getItem("remember::default")).toBe("true");
    expect(localStorage.getItem("remember::legacy")).toBe("true");
    expect(localStorage.getItem("token::default")).toBe("bad-1");
    expect(localStorage.getItem("token::legacy")).toBe("bad-2");
  });

  it("preserves remembered credentials on transient auto-unlock failures", async () => {
    localStorage.setItem("remember::default", "true");
    localStorage.setItem("token::default", "candidate-token");
    authGatewayMocks.runtime.unlockBoundProfile.mockRejectedValue(new Error("runtime_temporarily_unavailable"));

    render(
      <AuthGateway>
        <div>Runtime Children</div>
      </AuthGateway>,
    );

    await waitFor(() => {
      expect(authGatewayMocks.runtime.unlockBoundProfile).toHaveBeenCalledTimes(1);
    });
    expect(localStorage.getItem("remember::default")).toBe("true");
    expect(localStorage.getItem("token::default")).toBe("candidate-token");
  });

  it("recovers auto-unlock from native session when remember flag exists but token is missing", async () => {
    localStorage.setItem("remember::default", "true");
    authGatewayMocks.retryNativeSessionUnlock.mockResolvedValue(true);

    render(
      <AuthGateway>
        <div>Runtime Children</div>
      </AuthGateway>,
    );

    await waitFor(() => {
      expect(authGatewayMocks.retryNativeSessionUnlock).toHaveBeenCalledTimes(1);
    });
    expect(authGatewayMocks.runtime.unlockBoundProfile).not.toHaveBeenCalled();
  });

  it("emits scope drift diagnostics when only fallback profile token candidates exist", async () => {
    authGatewayMocks.runtime.snapshot.session.profileId = "bound-profile";
    localStorage.setItem("obscur_auth_token::other-profile", "token-from-other-profile");

    render(
      <AuthGateway>
        <div>Runtime Children</div>
      </AuthGateway>,
    );

    await waitFor(() => {
      expect(authGatewayMocks.runtime.unlockBoundProfile).toHaveBeenCalledTimes(1);
    });

    expect(logAppEvent).toHaveBeenCalledWith(expect.objectContaining({
      name: "auth.auto_unlock_scope_drift_detected",
      level: "warn",
      context: expect.objectContaining({
        profileId: "bound-profile",
        reasonCode: "fallback_token_profile_mismatch",
      }),
    }));
  });
});
