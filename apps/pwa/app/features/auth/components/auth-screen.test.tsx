import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { derivePublicKeyHex } from "@dweb/crypto/derive-public-key-hex";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import { AuthScreen } from "./auth-screen";
import { markRetiredIdentityPublicKey } from "../utils/retired-identity-registry";
import { PASSWORDLESS_NATIVE_ONLY_SENTINEL } from "../services/passwordless-native-only-identity";
import { hasPasswordProtectedUnlockOnDevice } from "@/app/features/profiles/services/identity-passphrase-unlock";
import en from "@/app/lib/i18n/locales/en.json";

const authScreenMocks = vi.hoisted(() => ({
  isNativeRuntime: false,
  hasStoredIdentity: true,
  identityState: {
    status: "locked" as const,
    stored: {
      publicKeyHex: "a".repeat(64),
    },
  },
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
  },
  authKernel: {
    ports: {
      authAssistant: {
        readEntry: vi.fn(async () => ({ status: "ok", value: null })),
        unlockWithAssistantGesture: vi.fn(async () => ({ status: "failed" })),
        saveUnlockMaterial: vi.fn(async () => ({ status: "ok" })),
      },
    },
    evaluateRegistrationGate: vi.fn(async () => ({
      evaluation: { allowed: true, powRequired: false, inviteRequired: false, policy: {} },
      powDifficulty: null,
      throttled: false,
      retryAfterMs: 0,
    })),
    createIdentityForBoundProfile: vi.fn(async () => undefined),
    unlockBoundProfileWithPassphrase: vi.fn(async () => undefined),
    importIdentityForBoundProfile: vi.fn(async () => undefined),
    signOutBoundProfileWindow: vi.fn(async () => undefined),
    lockBoundProfileWindow: vi.fn(async () => undefined),
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const template = (en.translation as Record<string, string | undefined>)[key] ?? key;
      return template.replace(/\{\{(.*?)\}\}/g, (_match, token: string) => String(options?.[token.trim()] ?? ""));
    },
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

vi.mock("@/app/features/profiles/services/identity-passphrase-unlock", () => ({
  hasPasswordProtectedUnlockOnDevice: vi.fn(async () => true),
}));

vi.mock("@/app/features/auth/hooks/use-identity", () => ({
  useIdentity: () => ({
    state: authScreenMocks.hasStoredIdentity
      ? authScreenMocks.identityState
      : {
          status: "locked" as const,
          stored: undefined,
        },
    getIdentityDiagnostics: () => authScreenMocks.identityDiagnostics,
    resetNativeSecureStorage: authScreenMocks.resetNativeSecureStorage,
  }),
  useIdentityInternals: {
    rehydrateIdentityForActiveProfile: vi.fn(async () => undefined),
  },
}));

vi.mock("@/app/features/auth-kernel/hooks/use-auth-kernel-surface-actions", () => ({
  useAuthKernelSurfaceActions: () => authScreenMocks.authKernel,
}));

vi.mock("@/app/features/runtime/services/window-runtime-supervisor", () => ({
  useWindowRuntime: () => authScreenMocks.runtime,
}));

vi.mock("@/app/features/profile/hooks/use-profile", () => ({
  useProfile: () => ({
    setUsername: vi.fn(),
    setInviteCode: vi.fn(),
    save: vi.fn(),
    state: {
      profile: {
        username: "",
      },
    },
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

vi.mock("@/app/features/runtime/runtime-capabilities", () => ({
  hasNativeRuntime: () => authScreenMocks.isNativeRuntime,
}));

describe("AuthScreen mismatch recovery UX", () => {
  beforeEach(() => {
    localStorage.clear();
    authScreenMocks.isNativeRuntime = false;
    authScreenMocks.identityState = {
      status: "locked",
      stored: {
        publicKeyHex: "a".repeat(64),
      },
    };
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
    authScreenMocks.authKernel.createIdentityForBoundProfile.mockClear();
    authScreenMocks.authKernel.unlockBoundProfileWithPassphrase.mockClear();
    authScreenMocks.authKernel.importIdentityForBoundProfile.mockClear();
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

  it("shows web-only unlock copy without stay signed in", async () => {
    render(<AuthScreen />);

    expect(await screen.findByText(/Enter your device login password to unlock/i)).toBeInTheDocument();
    expect(screen.queryByLabelText("Stay signed in on this device")).not.toBeInTheDocument();
  });

  it("shows login help note on native desktop instead of a stay-signed-in checkbox", async () => {
    authScreenMocks.isNativeRuntime = true;
    authScreenMocks.identityDiagnostics.mismatchReason = undefined;
    authScreenMocks.identityDiagnostics.message = undefined;
    authScreenMocks.runtime.snapshot.session.startupState.mismatchReason = undefined;
    authScreenMocks.runtime.snapshot.session.startupState.message = undefined;
    render(<AuthScreen />);

    expect(await screen.findByText("How sign-in works on this device")).toBeInTheDocument();
    expect(screen.queryByLabelText("Stay signed in on this device")).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /stay signed in/i })).not.toBeInTheDocument();
  });

  it("preserves device session consent on native auth screen mount", async () => {
    authScreenMocks.isNativeRuntime = true;
    localStorage.setItem("obscur_remember_me::default", "true");
    render(<AuthScreen />);

    await waitFor(() => {
      expect(localStorage.getItem("obscur_remember_me::default")).toBe("true");
    });
  });

  it("auto-enters login mode from startup state when stored identity is present", async () => {
    authScreenMocks.runtime.snapshot.session.startupState.kind = "stored_locked";
    authScreenMocks.runtime.snapshot.session.startupState.storedPublicKeyHex = "a".repeat(64);

    render(<AuthScreen />);

    expect(await screen.findByText("Welcome Back")).toBeInTheDocument();
  });

  it("never shows restore-from-backup block on the login tab", async () => {
    render(<AuthScreen />);

    expect(await screen.findByText("Welcome Back")).toBeInTheDocument();
    expect(screen.queryByText("Choose unified backup")).not.toBeInTheDocument();
    expect(screen.queryByText("RESTORE FROM BACKUP")).not.toBeInTheDocument();
  });

  it("hides first-time restore hints when this profile window already has local identity", async () => {
    authScreenMocks.hasStoredIdentity = true;
    authScreenMocks.identityState = {
      status: "locked",
      stored: {
        publicKeyHex: "a".repeat(64),
        username: "Tester1",
      },
    } as unknown as typeof authScreenMocks.identityState;
    authScreenMocks.runtime.snapshot.session.startupState.kind = "stored_locked";
    authScreenMocks.runtime.snapshot.session.startupState.storedPublicKeyHex = "a".repeat(64);

    render(<AuthScreen />);

    expect(await screen.findByText("Welcome Back")).toBeInTheDocument();
    expect(screen.queryByText("Choose unified backup")).not.toBeInTheDocument();
    expect(screen.queryByText(/Importing your private key unlocks this account/)).not.toBeInTheDocument();
  });

  it("stays on the welcome screen when startup state reports no identity", async () => {
    authScreenMocks.hasStoredIdentity = false;
    authScreenMocks.identityState = {
      status: "locked",
      stored: undefined,
    } as unknown as typeof authScreenMocks.identityState;
    authScreenMocks.runtime.snapshot.session.startupState.kind = "no_identity";
    authScreenMocks.runtime.snapshot.session.startupState.storedPublicKeyHex = undefined;

    render(<AuthScreen />);

    expect(await screen.findByText("Create New Identity")).toBeInTheDocument();
    expect(screen.queryByText("Welcome Back")).not.toBeInTheDocument();
  });

  it("opens login when device has stored identity but startup session is still no_identity", async () => {
    authScreenMocks.hasStoredIdentity = true;
    authScreenMocks.identityState = {
      status: "locked",
      stored: {
        publicKeyHex: "a".repeat(64),
      },
    };
    authScreenMocks.runtime.snapshot.session.startupState.kind = "no_identity";
    authScreenMocks.runtime.snapshot.session.startupState.storedPublicKeyHex = undefined;

    render(<AuthScreen />);

    expect(await screen.findByText("Welcome Back")).toBeInTheDocument();
    expect(screen.queryByText("Create New Identity")).not.toBeInTheDocument();
  });

  it("stays on welcome until identity finishes loading even when startup is no_identity", async () => {
    authScreenMocks.hasStoredIdentity = true;
    authScreenMocks.identityState = {
      status: "loading",
      stored: undefined,
    } as unknown as typeof authScreenMocks.identityState;
    authScreenMocks.runtime.snapshot.session.startupState.kind = "no_identity";
    authScreenMocks.runtime.snapshot.session.startupState.storedPublicKeyHex = undefined;

    render(<AuthScreen />);

    expect(await screen.findByText("Create New Identity")).toBeInTheDocument();
    expect(screen.queryByText("Welcome Back")).not.toBeInTheDocument();
  });

  it("imports private key directly without the secure-session password step", async () => {
    const privateKeyHex = "b".repeat(64) as PrivateKeyHex;

    render(<AuthScreen />);
    fireEvent.click(await screen.findByRole("button", { name: "Import Key" }));
    fireEvent.change(screen.getByPlaceholderText("nsec1..."), {
      target: { value: privateKeyHex },
    });
    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));

    await waitFor(() => {
      expect(authScreenMocks.authKernel.importIdentityForBoundProfile).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByText("Secure Your Session")).not.toBeInTheDocument();
    expect(screen.queryByText("Skip Password")).not.toBeInTheDocument();
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
    const continueButton = screen.getByRole("button", { name: "Unlock" });
    expect(continueButton).toBeDisabled();

    expect(screen.getByText(/reactivating it can restore prior identity links/i)).toBeInTheDocument();
    expect(authScreenMocks.authKernel.importIdentityForBoundProfile).not.toHaveBeenCalled();
  });

  it("guides passwordless profiles without a saved device password through key-first setup", async () => {
    vi.mocked(hasPasswordProtectedUnlockOnDevice).mockResolvedValueOnce(false);
    authScreenMocks.identityState = {
      status: "locked",
      stored: {
        publicKeyHex: "a".repeat(64),
        encryptedPrivateKey: PASSWORDLESS_NATIVE_ONLY_SENTINEL,
        username: "Tester2",
      },
    } as unknown as typeof authScreenMocks.identityState;

    render(<AuthScreen />);

    expect(await screen.findByText(/No device login password is saved/i)).toBeInTheDocument();
    expect(screen.getByText(/Step 1: paste your private key/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Continue with private key/i })).toBeInTheDocument();
  });

});
