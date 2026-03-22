import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthScreen } from "./auth-screen";

const authScreenMocks = vi.hoisted(() => ({
  identityDiagnostics: {
    status: "locked" as const,
    mismatchReason: undefined as "stored_public_key_invalid" | "native_mismatch" | "private_key_mismatch" | undefined,
    message: undefined as string | undefined,
  },
  resetNativeSecureStorage: vi.fn(async () => undefined),
  runtime: {
    snapshot: {
      phase: "auth_required",
      session: {
        profileId: "default",
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

vi.mock("@dweb/ui-kit", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  Input: React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>((props, ref) => (
    <input ref={ref} {...props} />
  )),
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
}));

vi.mock("@/app/features/auth/hooks/use-identity", () => ({
  useIdentity: () => ({
    state: {
      status: "locked",
      stored: {
        publicKeyHex: "a".repeat(64),
      },
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
    authScreenMocks.resetNativeSecureStorage.mockClear();
    authScreenMocks.runtime.snapshot.phase = "auth_required";
    authScreenMocks.runtime.snapshot.session.profileId = "default";
    authScreenMocks.runtime.createIdentityForBoundProfile.mockClear();
    authScreenMocks.runtime.unlockBoundProfile.mockClear();
    authScreenMocks.runtime.importIdentityForBoundProfile.mockClear();
  });

  it("renders native secure storage mismatch recovery card", async () => {
    authScreenMocks.identityDiagnostics.mismatchReason = "native_mismatch";
    authScreenMocks.identityDiagnostics.message = "Secure storage belonged to another account.";

    render(<AuthScreen />);

    expect(await screen.findByText("Secure Storage Needs Recovery")).toBeInTheDocument();
    expect(screen.getByText("Secure storage belonged to another account.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset Secure Storage" })).toBeInTheDocument();
  });

  it("renders private key mismatch recovery card", async () => {
    authScreenMocks.identityDiagnostics.mismatchReason = "private_key_mismatch";
    authScreenMocks.identityDiagnostics.message = "Private key does not match stored identity.";

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

});
