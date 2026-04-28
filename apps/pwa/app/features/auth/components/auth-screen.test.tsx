import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { derivePublicKeyHex } from "@dweb/crypto/derive-public-key-hex";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import { AuthScreen } from "./auth-screen";
import { markRetiredIdentityPublicKey } from "../utils/retired-identity-registry";

const authScreenMocks = vi.hoisted(() => ({
  hasStoredIdentity: true,
  identityDiagnostics: {
    status: "locked" as const,
    startupState: {
      kind: "pending",
      identityStatus: "loading",
      runtimePhaseHint: "binding_profile",
      degradedReasonHint: "none",
      recoveryActions: [],
    },
    mismatchReason: undefined as "stored_public_key_invalid" | "native_mismatch" | "private_key_mismatch" | undefined,
    message: undefined as string | undefined,
  },
  resetNativeSecureStorage: vi.fn(async () => undefined),
  runtime: {
    snapshot: {
      phase: "auth_required",
      session: {
        profileId: "default",
        startupState: {
          kind: "stored_locked",
          storedPublicKeyHex: "a".repeat(64) as string | undefined,
          mismatchReason: undefined as "stored_public_key_invalid" | "native_mismatch" | "private_key_mismatch" | undefined,
          message: undefined as string | undefined,
        },
      },
    },
    createIdentityForBoundProfile: vi.fn(async () => undefined),
    unlockBoundProfile: vi.fn(async () => undefined),
    importIdentityForBoundProfile: vi.fn(async () => undefined),
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

vi.mock("next/image", () => ({
  default: ({ priority: _priority, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean }) => (
    <img {...props} alt={props.alt ?? ""} />
  ),
}));

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: new Proxy({}, {
    get: () => {
      return ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>;
    },
  }),
}));

vi.mock("@dweb/ui-kit", () => {
  const MockInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function MockInput(props, ref) {
    return <input ref={ref} {...props} />;
  });

  return {
    Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
      <button {...props}>{children}</button>
    ),
    Input: MockInput,
    Card: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
    Label: ({ children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => <label {...props}>{children}</label>,
    Checkbox: ({ checked, onCheckedChange, ...props }: {
      checked?: boolean;
      onCheckedChange?: (checked: boolean) => void;
    } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange">) => (
      <input
        {...props}
        type="checkbox"
        checked={Boolean(checked)}
        onChange={(event) => onCheckedChange?.(event.target.checked)}
      />
    ),
    toast: {
      success: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
    },
    cn: (...parts: Array<string | null | undefined | false>) => parts.filter(Boolean).join(" "),
  };
});

vi.mock("@/app/features/auth/hooks/use-identity", () => ({
  useIdentity: () => ({
    state: {
      status: "locked",
      stored: authScreenMocks.hasStoredIdentity
        ? {
            publicKeyHex: "a".repeat(64),
          }
        : null,
    },
    getIdentityDiagnostics: () => authScreenMocks.identityDiagnostics,
    resetNativeSecureStorage: authScreenMocks.resetNativeSecureStorage,
  }),
}));

vi.mock("@/app/features/runtime/services/window-runtime-supervisor", () => ({
  useWindowRuntime: () => authScreenMocks.runtime,
}));

vi.mock("@/app/features/profile/hooks/use-profile", () => ({
  useProfile: () => ({
    setUsername: vi.fn(),
    setInviteCode: vi.fn(),
    save: vi.fn(),
  }),
}));

vi.mock("@/app/components/language-selector", () => ({
  LanguageSelector: () => <div>language-selector</div>,
}));

vi.mock("@/app/components/ui/flash-message", () => ({
  FlashMessage: ({ message }: { message?: string | null }) => (message ? <div>{message}</div> : null),
}));

vi.mock("@/app/components/password-strength-indicator", () => ({
  PasswordStrengthIndicator: () => <div>password-strength-indicator</div>,
}));

vi.mock("@/app/shared/log-app-event", () => ({
  logAppEvent: vi.fn(),
}));

describe("AuthScreen mismatch recovery UX", () => {
  beforeEach(() => {
    localStorage.clear();
    authScreenMocks.identityDiagnostics.mismatchReason = undefined;
    authScreenMocks.identityDiagnostics.message = undefined;
    authScreenMocks.identityDiagnostics.startupState = {
      kind: "pending",
      identityStatus: "loading",
      runtimePhaseHint: "binding_profile",
      degradedReasonHint: "none",
      recoveryActions: [],
    };
    authScreenMocks.hasStoredIdentity = true;
    authScreenMocks.resetNativeSecureStorage.mockClear();
    authScreenMocks.runtime.snapshot.phase = "auth_required";
    authScreenMocks.runtime.snapshot.session.profileId = "default";
    authScreenMocks.runtime.snapshot.session.startupState.kind = "stored_locked";
    authScreenMocks.runtime.snapshot.session.startupState.storedPublicKeyHex = "a".repeat(64);
    authScreenMocks.runtime.snapshot.session.startupState.mismatchReason = undefined;
    authScreenMocks.runtime.createIdentityForBoundProfile.mockClear();
    authScreenMocks.runtime.unlockBoundProfile.mockClear();
    authScreenMocks.runtime.importIdentityForBoundProfile.mockClear();
  });

  it("renders native secure storage mismatch recovery card", async () => {
    authScreenMocks.identityDiagnostics.mismatchReason = "native_mismatch";
    authScreenMocks.identityDiagnostics.message = "Secure storage belonged to another account.";
    authScreenMocks.runtime.snapshot.session.startupState.kind = "mismatch";
    authScreenMocks.runtime.snapshot.session.startupState.mismatchReason = "native_mismatch";
    authScreenMocks.runtime.snapshot.session.startupState.message = "Secure storage belonged to another account.";

    render(<AuthScreen />);

    expect(await screen.findByText("Secure Storage Needs Recovery")).toBeInTheDocument();
    expect(screen.getByText("Secure storage belonged to another account.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset Secure Storage" })).toBeInTheDocument();
  });

  it("renders private key mismatch recovery card", async () => {
    authScreenMocks.identityDiagnostics.mismatchReason = "private_key_mismatch";
    authScreenMocks.identityDiagnostics.message = "Private key does not match stored identity.";
    authScreenMocks.runtime.snapshot.session.startupState.kind = "mismatch";
    authScreenMocks.runtime.snapshot.session.startupState.mismatchReason = "private_key_mismatch";
    authScreenMocks.runtime.snapshot.session.startupState.message = "Private key does not match stored identity.";

    render(<AuthScreen />);

    expect(await screen.findByText("Private Key Mismatch")).toBeInTheDocument();
    expect(screen.getByText("Private key does not match stored identity.")).toBeInTheDocument();
    expect(screen.queryByText("Secure Storage Needs Recovery")).not.toBeInTheDocument();
  });

  it("persists remember-me credentials when importing with private key and skip-password", async () => {
    render(<AuthScreen />);

    fireEvent.click(await screen.findByRole("button", { name: "Import Key" }));
    fireEvent.change(screen.getByPlaceholderText("nsec1..."), {
      target: { value: "a".repeat(64) },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(await screen.findByRole("button", { name: "Skip Password" }));

    await waitFor(() => {
      expect(authScreenMocks.runtime.importIdentityForBoundProfile).toHaveBeenCalledTimes(1);
    });

    expect(localStorage.getItem("obscur_remember_me::default")).toBe("true");
    const token = localStorage.getItem("obscur_auth_token::default");
    expect(typeof token).toBe("string");
    expect((token ?? "").length).toBeGreaterThan(0);
  });

  it("defaults remember-me to enabled for stored identities even when a stale false marker exists", async () => {
    localStorage.setItem("obscur_remember_me::default", "false");
    render(<AuthScreen />);

    const rememberCheckbox = await screen.findByLabelText("Keep me logged in on this device");
    expect(rememberCheckbox).toBeChecked();
  });

  it("auto-enters login mode from startup state when stored identity is present", async () => {
    authScreenMocks.runtime.snapshot.session.startupState.kind = "stored_locked";
    authScreenMocks.runtime.snapshot.session.startupState.storedPublicKeyHex = "a".repeat(64);

    render(<AuthScreen />);

    expect(await screen.findByText("Welcome Back")).toBeInTheDocument();
  });

  it("stays on the welcome screen when startup state reports no identity", async () => {
    authScreenMocks.hasStoredIdentity = false;
    authScreenMocks.runtime.snapshot.session.startupState.kind = "no_identity";
    authScreenMocks.runtime.snapshot.session.startupState.storedPublicKeyHex = undefined;

    render(<AuthScreen />);

    expect(await screen.findByText("Create New Identity")).toBeInTheDocument();
    expect(screen.queryByText("Welcome Back")).not.toBeInTheDocument();
  });

  it("surfaces retired-key warning before import continues", async () => {
    const privateKeyHex = "a".repeat(64) as PrivateKeyHex;
    const publicKeyHex = derivePublicKeyHex(privateKeyHex);
    markRetiredIdentityPublicKey({ publicKeyHex, profileId: "default" });

    render(<AuthScreen />);
    fireEvent.click(await screen.findByRole("button", { name: "Import Key" }));
    fireEvent.change(screen.getByPlaceholderText("nsec1..."), {
      target: { value: privateKeyHex },
    });

    expect(screen.getByText(/previously marked as retired/i)).toBeInTheDocument();
    const continueButton = screen.getByRole("button", { name: "Continue" });
    expect(continueButton).toBeDisabled();

    expect(screen.getByText(/reactivating it can restore prior identity links/i)).toBeInTheDocument();
    expect(authScreenMocks.runtime.importIdentityForBoundProfile).not.toHaveBeenCalled();
  });

});
