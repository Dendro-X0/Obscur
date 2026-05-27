import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthGateway } from "./auth-gateway";
import { SESSION_AUTO_UNLOCK_ENABLED } from "@/app/features/auth/services/session-credential-policy";

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
        startupState: {
          kind: "stored_locked",
          identityStatus: "locked",
        },
      },
    },
    unlockBoundProfile: vi.fn(),
  } as {
    snapshot: {
      phase: string;
      session: {
        profileId: string;
        startupState: {
          kind: string;
          identityStatus: string;
        };
      };
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

vi.mock("@/app/shared/log-app-event", () => ({
  logAppEvent: vi.fn(),
}));

describe("AuthGateway", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    authGatewayMocks.identityState.status = "locked";
    authGatewayMocks.identityState.stored = { publicKeyHex: "a".repeat(64) };
    authGatewayMocks.runtime.snapshot.phase = "auth_required";
    authGatewayMocks.runtime.snapshot.session.profileId = "default";
    authGatewayMocks.runtime.snapshot.session.startupState.kind = "stored_locked";
    authGatewayMocks.runtime.snapshot.session.startupState.identityStatus = "locked";
  });

  it("does not auto-unlock when session credential policy disables it", () => {
    expect(SESSION_AUTO_UNLOCK_ENABLED).toBe(false);

    localStorage.setItem("obscur_remember_me::default", "true");
    localStorage.setItem("obscur_auth_token::default", "secret-passphrase");

    render(
      <AuthGateway>
        <div>Runtime Children</div>
      </AuthGateway>,
    );

    expect(screen.getByText("Profile Bound Auth Shell")).toBeInTheDocument();
    expect(authGatewayMocks.runtime.unlockBoundProfile).not.toHaveBeenCalled();
    expect(authGatewayMocks.retryNativeSessionUnlock).not.toHaveBeenCalled();
  });
});
