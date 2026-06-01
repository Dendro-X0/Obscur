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
    unlockBoundProfile: vi.fn(async () => {
      throw new Error("Unable to authenticate stored identity");
    }),
    unlockBoundProfileWithPrivateKeyHex: vi.fn(async () => {
      throw new Error("Private key does not match stored identity");
    }),
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
    unlockBoundProfileWithPrivateKeyHex: ReturnType<typeof vi.fn>;
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

vi.mock("@/app/features/runtime/runtime-capabilities", () => ({
  hasNativeRuntime: () => false,
}));

const sessionPolicyMocks = vi.hoisted(() => ({
  SESSION_AUTO_UNLOCK_ENABLED: false,
}));

vi.mock("@/app/features/auth/services/session-credential-policy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/features/auth/services/session-credential-policy")>();
  return {
    ...actual,
    get SESSION_AUTO_UNLOCK_ENABLED() {
      return sessionPolicyMocks.SESSION_AUTO_UNLOCK_ENABLED;
    },
  };
});

vi.mock("@/app/features/runtime/components/profile-bound-auth-shell", () => ({
  ProfileBoundAuthShell: () => <div>Profile Bound Auth Shell</div>,
}));

vi.mock("@/app/shared/log-app-event", () => ({
  logAppEvent: vi.fn(),
}));

describe("AuthGateway", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionPolicyMocks.SESSION_AUTO_UNLOCK_ENABLED = false;
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

  it("attempts auto-unlock once and falls back to auth shell when credentials fail", async () => {
    sessionPolicyMocks.SESSION_AUTO_UNLOCK_ENABLED = true;
    localStorage.setItem("obscur_remember_me::default", "true");
    localStorage.setItem("obscur_auth_token::default", "secret-passphrase");

    const { rerender } = render(
      <AuthGateway>
        <div>Runtime Children</div>
      </AuthGateway>,
    );

    await vi.waitFor(() => {
      expect(authGatewayMocks.runtime.unlockBoundProfile).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText("Profile Bound Auth Shell")).toBeInTheDocument();

    authGatewayMocks.runtime.snapshot.phase = "binding_profile";
    rerender(
      <AuthGateway>
        <div>Runtime Children</div>
      </AuthGateway>,
    );

    expect(authGatewayMocks.runtime.unlockBoundProfile).toHaveBeenCalledTimes(1);
  });

  it("auto-unlocks hex-key tokens with the private-key path", async () => {
    sessionPolicyMocks.SESSION_AUTO_UNLOCK_ENABLED = true;
    const privateKeyHex = "b".repeat(64);
    localStorage.setItem("obscur_remember_me::default", "true");
    localStorage.setItem("obscur_auth_token::default", privateKeyHex);
    authGatewayMocks.runtime.unlockBoundProfileWithPrivateKeyHex.mockResolvedValueOnce(undefined);

    render(
      <AuthGateway>
        <div>Runtime Children</div>
      </AuthGateway>,
    );

    await vi.waitFor(() => {
      expect(authGatewayMocks.runtime.unlockBoundProfileWithPrivateKeyHex).toHaveBeenCalledWith({
        privateKeyHex,
      });
    });
    expect(authGatewayMocks.runtime.unlockBoundProfile).not.toHaveBeenCalled();
  });
});
