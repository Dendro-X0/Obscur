import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { derivePublicKeyHex } from "@dweb/crypto/derive-public-key-hex";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import { AuthScreen } from "./auth-screen";
import { markRetiredIdentityPublicKey } from "../utils/retired-identity-registry";
import { PASSWORDLESS_NATIVE_ONLY_SENTINEL } from "../services/passwordless-native-only-identity";
import { hasPasswordProtectedUnlockOnDevice } from "@/app/features/profiles/services/identity-passphrase-unlock";
import { requiresFreshProfileWindowForGreenfieldAuth } from "@/app/features/profiles/services/profile-slot-greenfield-auth-routing";
import { openFreshProfileWindowForSignIn } from "@/app/features/profiles/services/profile-slot-account-switch";
import en from "@/app/lib/i18n/locales/en.json";
import { readIdentityRecordFromLocalStorage } from "@/app/features/auth/utils/identity-persistence";

const authScreenMocks = vi.hoisted(() => ({
  isNativeRuntime: false,
  hasStoredIdentity: true,
  manualLockActive: false,
  resolveIdentityScopeProfileId: vi.fn(() => "default"),
  identityState: {
    status: "locked" as const,
    stored: {
      publicKeyHex: "a".repeat(64),
    } as { publicKeyHex: string; username?: string },
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
  resetPassphraseWithPrivateKey: vi.fn(async () => undefined),
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
    unlockBoundProfileWithPrivateKeyHex: vi.fn(async () => undefined),
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
    createPoWIdentityForBoundProfile: vi.fn(async () => undefined),
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

vi.mock("@dweb/ui-kit/button", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("@dweb/ui-kit/input", () => ({
  Input: React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function MockInput(props, ref) {
    return <input ref={ref} {...props} />;
  }),
}));

vi.mock("@dweb/ui-kit/card", () => ({
  Card: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

vi.mock("@dweb/ui-kit/label", () => ({
  Label: ({ children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => <label {...props}>{children}</label>,
}));

vi.mock("@dweb/ui-kit/checkbox", () => ({
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
}));

vi.mock("@dweb/ui-kit/toast", () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/app/features/profiles/services/identity-passphrase-unlock", () => ({
  hasPasswordProtectedUnlockOnDevice: vi.fn(async () => true),
}));

vi.mock("@/app/features/profiles/services/read-active-desktop-profile-id", async () => {
  const actual = await vi.importActual<
    typeof import("@/app/features/profiles/services/read-active-desktop-profile-id")
  >("@/app/features/profiles/services/read-active-desktop-profile-id");
  return {
    ...actual,
    resolveIdentityScopeProfileId: () => authScreenMocks.resolveIdentityScopeProfileId(),
  };
});

vi.mock("@/app/features/auth/utils/identity-persistence", async () => {
  const actual = await vi.importActual<typeof import("@/app/features/auth/utils/identity-persistence")>(
    "@/app/features/auth/utils/identity-persistence",
  );
  return {
    ...actual,
    readIdentityRecordFromLocalStorage: vi.fn(),
  };
});

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
    resetPassphraseWithPrivateKey: authScreenMocks.resetPassphraseWithPrivateKey,
  }),
  getIdentitySnapshot: () => (authScreenMocks.hasStoredIdentity
    ? authScreenMocks.identityState
    : {
        status: "locked" as const,
        stored: undefined,
      }),
  useIdentityInternals: {
    rehydrateIdentityForActiveProfile: vi.fn(async () => undefined),
  },
}));

vi.mock("@/app/features/auth-kernel/hooks/use-auth-kernel-surface-actions", () => ({
  useAuthKernelSurfaceActions: () => authScreenMocks.authKernel,
}));

vi.mock("@/app/features/auth-kernel/auth-kernel-manual-lock-state", () => ({
  isAuthKernelManualLockActive: vi.fn(() => authScreenMocks.manualLockActive),
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

const storageAtRestMocks = vi.hoisted(() => ({
  ensureNativeSqliteOpenForWrites: vi.fn(async () => true),
  activateNativeStorageAtRestUnlock: vi.fn(async () => true),
  restoreNativeVaultEncryptionSessionIfNeeded: vi.fn(async () => false),
}));

vi.mock("@/app/features/storage/services/native-storage-at-rest-service", () => ({
  ensureNativeSqliteOpenForWrites: storageAtRestMocks.ensureNativeSqliteOpenForWrites,
  activateNativeStorageAtRestUnlock: storageAtRestMocks.activateNativeStorageAtRestUnlock,
  restoreNativeVaultEncryptionSessionIfNeeded: storageAtRestMocks.restoreNativeVaultEncryptionSessionIfNeeded,
}));

vi.mock("@/app/features/profiles/services/profile-slot-greenfield-auth-routing", async () => {
  const actual = await vi.importActual<typeof import("@/app/features/profiles/services/profile-slot-greenfield-auth-routing")>(
    "@/app/features/profiles/services/profile-slot-greenfield-auth-routing",
  );
  return {
    ...actual,
    requiresFreshProfileWindowForGreenfieldAuth: vi.fn(actual.requiresFreshProfileWindowForGreenfieldAuth),
  };
});

vi.mock("@/app/features/profiles/services/profile-slot-account-switch", () => ({
  openFreshProfileWindowForSignIn: vi.fn(async () => "demo-slot"),
  clearProfileSlotForDifferentAccount: vi.fn(async () => null),
}));

vi.mock("@/app/features/profiles/services/profile-window-account-binding", () => ({
  getLastBoundAccountPublicKeyHex: vi.fn(() => null),
  clearLastBoundAccountPublicKeyHex: vi.fn(),
  setLastBoundAccountPublicKeyHex: vi.fn(),
}));

import { getLastBoundAccountPublicKeyHex } from "@/app/features/profiles/services/profile-window-account-binding";

/**
 * React 19 + fireEvent.click does not reliably invoke onClick on these tab
 * buttons in jsdom; call the fiber props handler directly when present.
 */
const readReactProps = (element: HTMLElement): Record<string, unknown> | undefined => {
  const propsKey = Object.keys(element).find((key) => key.startsWith("__reactProps"));
  return propsKey
    ? (element as unknown as Record<string, Record<string, unknown>>)[propsKey]
    : undefined;
};

const invokeReactClick = async (element: HTMLElement): Promise<void> => {
  const reactProps = readReactProps(element);
  await act(async () => {
    if (typeof reactProps?.onClick === "function") {
      (reactProps.onClick as (event: unknown) => void)({
        type: "click",
        preventDefault() {},
        stopPropagation() {},
      });
      return;
    }
    fireEvent.click(element);
  });
};

const clickAuthLoginTab = async (name: "Import Key" | "Log In"): Promise<void> => {
  await waitFor(() => {
    const advanced = screen.queryByRole("button", { name: /Advanced: unlock with private key/i });
    const hideAdvanced = screen.queryByRole("button", { name: /Hide private key unlock/i });
    const tab = screen.queryByRole("button", { name });
    expect(advanced || hideAdvanced || tab).toBeTruthy();
  });
  if (name === "Import Key") {
    const advanced = screen.queryByRole("button", { name: /Advanced: unlock with private key/i });
    if (advanced) {
      await invokeReactClick(advanced);
      return;
    }
  }
  if (name === "Log In") {
    const hideAdvanced = screen.queryByRole("button", { name: /Hide private key unlock/i });
    if (hideAdvanced) {
      await invokeReactClick(hideAdvanced);
      return;
    }
  }
  const tab = await screen.findByRole("button", { name });
  await invokeReactClick(tab);
};

describe("AuthScreen mismatch recovery UX", () => {
  beforeEach(async () => {
    const { resetDevicePasswordBindPendingForTests } = await import(
      "@/app/features/auth/services/device-password-bind-pending"
    );
    resetDevicePasswordBindPendingForTests();
    localStorage.clear();
    authScreenMocks.isNativeRuntime = false;
    storageAtRestMocks.ensureNativeSqliteOpenForWrites.mockReset();
    storageAtRestMocks.ensureNativeSqliteOpenForWrites.mockResolvedValue(true);
    storageAtRestMocks.activateNativeStorageAtRestUnlock.mockReset();
    storageAtRestMocks.activateNativeStorageAtRestUnlock.mockResolvedValue(true);
    storageAtRestMocks.restoreNativeVaultEncryptionSessionIfNeeded.mockReset();
    storageAtRestMocks.restoreNativeVaultEncryptionSessionIfNeeded.mockResolvedValue(false);
    authScreenMocks.resetPassphraseWithPrivateKey.mockClear();
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
    authScreenMocks.resolveIdentityScopeProfileId.mockReset();
    authScreenMocks.resolveIdentityScopeProfileId.mockReturnValue("default");
    vi.mocked(hasPasswordProtectedUnlockOnDevice).mockReset();
    vi.mocked(hasPasswordProtectedUnlockOnDevice).mockResolvedValue(true);
    authScreenMocks.resetNativeSecureStorage.mockClear();
    authScreenMocks.runtime.snapshot.phase = "auth_required";
    authScreenMocks.runtime.snapshot.session.profileId = "default";
    authScreenMocks.runtime.snapshot.session.startupState.kind = "stored_locked";
    authScreenMocks.runtime.snapshot.session.startupState.storedPublicKeyHex = "a".repeat(64);
    authScreenMocks.runtime.snapshot.session.startupState.mismatchReason = undefined;
    authScreenMocks.authKernel.createIdentityForBoundProfile.mockClear();
    authScreenMocks.authKernel.unlockBoundProfileWithPassphrase.mockReset();
    authScreenMocks.authKernel.unlockBoundProfileWithPassphrase.mockResolvedValue(undefined);
    authScreenMocks.authKernel.importIdentityForBoundProfile.mockClear();
    authScreenMocks.runtime.unlockBoundProfileWithPrivateKeyHex.mockReset();
    authScreenMocks.runtime.unlockBoundProfileWithPrivateKeyHex.mockResolvedValue(undefined);
    vi.mocked(requiresFreshProfileWindowForGreenfieldAuth).mockReturnValue(false);
    vi.mocked(openFreshProfileWindowForSignIn).mockClear();
    vi.mocked(getLastBoundAccountPublicKeyHex).mockReturnValue(null);
    vi.mocked(readIdentityRecordFromLocalStorage).mockReset();
    authScreenMocks.manualLockActive = false;
  });

  it("renders manual lock conflict banner when profile was locked locally", async () => {
    authScreenMocks.manualLockActive = true;
    render(<AuthScreen />);
    expect(await screen.findByRole("alert", { name: /manual lock active/i })).toBeTruthy();
    expect(screen.getByText("Profile locked")).toBeTruthy();
    expect(screen.getByText(/Unlock this window to continue/i)).toBeTruthy();
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

  it("defaults browser unlock to Import Key when no device password wrapper exists", async () => {
    vi.mocked(hasPasswordProtectedUnlockOnDevice).mockResolvedValue(false);
    render(<AuthScreen />);

    expect(await screen.findByPlaceholderText("nsec1...")).toBeTruthy();
    expect(document.body.textContent ?? "").toMatch(/Paste your private key to unlock/i);
    expect(screen.queryByLabelText("Stay signed in on this device")).not.toBeInTheDocument();
  });

  it("keeps passphrase unlock primary when a device password wrapper exists", async () => {
    vi.mocked(hasPasswordProtectedUnlockOnDevice).mockResolvedValue(true);
    authScreenMocks.identityState = {
      status: "locked",
      stored: {
        publicKeyHex: "a".repeat(64),
        username: "DemoUser",
      },
    };
    render(<AuthScreen />);

    expect(await screen.findByTestId("auth-unlock-account")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "DemoUser" })).toBeTruthy();
    expect(screen.getByText("Signing in as")).toBeTruthy();
    expect(screen.queryByText("Welcome Back")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByPlaceholderText("nsec1...")).not.toBeInTheDocument();
    });
    expect(screen.getByText(/Advanced: unlock with private key/i)).toBeTruthy();
    fireEvent.click(screen.getByText(/Advanced: unlock with private key/i));
    expect(await screen.findByPlaceholderText("nsec1...")).toBeTruthy();
  });

  it("shows device-password copy on passphrase unlock without stay signed in", async () => {
    vi.mocked(hasPasswordProtectedUnlockOnDevice).mockResolvedValue(true);
    render(<AuthScreen />);

    await waitFor(() => {
      expect(document.body.textContent ?? "").toMatch(/Device password · this computer only/i);
    });
    expect(screen.queryByLabelText("Stay signed in on this device")).not.toBeInTheDocument();
  });

  it("probes device password unlock with identity-scope profile id when session says default", async () => {
    authScreenMocks.resolveIdentityScopeProfileId.mockReturnValue("pk-e07f67dcb8a58f53b13");
    authScreenMocks.runtime.snapshot.session.profileId = "default";
    vi.mocked(hasPasswordProtectedUnlockOnDevice).mockClear();

    render(<AuthScreen />);

    await waitFor(() => {
      expect(hasPasswordProtectedUnlockOnDevice).toHaveBeenCalledWith(
        expect.objectContaining({ profileId: "pk-e07f67dcb8a58f53b13" }),
      );
    });
  });

  it("unlocks returning accounts from Import Key without a password field", async () => {
    vi.mocked(hasPasswordProtectedUnlockOnDevice).mockResolvedValue(false);
    render(<AuthScreen />);
    expect(await screen.findByPlaceholderText("nsec1...")).toBeTruthy();
    expect(screen.queryByText(/Device login password \(optional/i)).not.toBeInTheDocument();
    expect(document.body.textContent ?? "").toMatch(/Paste your private key to unlock/i);
  });

  it("shows login help note on native desktop instead of a stay-signed-in checkbox", async () => {
    authScreenMocks.isNativeRuntime = true;
    authScreenMocks.identityDiagnostics.mismatchReason = undefined;
    authScreenMocks.identityDiagnostics.message = undefined;
    authScreenMocks.runtime.snapshot.session.startupState.mismatchReason = undefined;
    authScreenMocks.runtime.snapshot.session.startupState.message = undefined;
    render(<AuthScreen />);

    const about = await screen.findByText(/About sign-in & privacy/i);
    fireEvent.click(about);
    await waitFor(() => {
      expect(document.body.textContent ?? "").toMatch(/How sign-in works on this device/);
    });
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

    expect(await screen.findByTestId("auth-unlock-account")).toBeTruthy();
    expect(screen.getByText("Signing in as")).toBeTruthy();
  });

  it("never shows restore-from-backup block on the login tab", async () => {
    render(<AuthScreen />);

    expect(await screen.findByTestId("auth-unlock-account")).toBeTruthy();
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

    expect(await screen.findByRole("heading", { name: "Tester1" })).toBeTruthy();
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

    expect(await screen.findByTestId("auth-unlock-account")).toBeTruthy();
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
    authScreenMocks.hasStoredIdentity = false;
    authScreenMocks.identityState = {
      status: "locked",
      stored: undefined,
    } as unknown as typeof authScreenMocks.identityState;
    authScreenMocks.runtime.snapshot.session.startupState.kind = "no_identity";
    authScreenMocks.runtime.snapshot.session.startupState.storedPublicKeyHex = undefined;

    render(<AuthScreen />);
    fireEvent.click(await screen.findByRole("button", { name: "Log In with Key" }));
    fireEvent.change(screen.getByPlaceholderText("nsec1..."), {
      target: { value: privateKeyHex },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(authScreenMocks.authKernel.importIdentityForBoundProfile).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByText("Secure Your Session")).not.toBeInTheDocument();
    expect(screen.queryByText("Skip Password")).not.toBeInTheDocument();
  });

  it("shows soft wrong-key notice when Import Key is a different account", async () => {
    const occupant = "a".repeat(64);
    const differentPrivateKey = "c09832d637eb265d90b29c12eb8dfcfffe165b8fb34094af75236d5be4d97884" as PrivateKeyHex;
    expect(derivePublicKeyHex(differentPrivateKey)).not.toBe(occupant);
    vi.mocked(getLastBoundAccountPublicKeyHex).mockReturnValue(occupant as never);
    localStorage.setItem(
      "dweb.nostr.pwa.profile::default",
      JSON.stringify({ version: 1, profile: { username: "Tester1" } }),
    );
    authScreenMocks.identityState = {
      status: "locked",
      stored: {
        publicKeyHex: occupant,
        username: "DemoUser",
      },
    };

    render(<AuthScreen />);
    expect(await screen.findByRole("heading", { name: "Tester1" })).toBeTruthy();
    await clickAuthLoginTab("Import Key");
    fireEvent.change(screen.getByPlaceholderText("nsec1..."), {
      target: { value: differentPrivateKey },
    });

    expect(await screen.findByTestId("auth-wrong-key-for-occupant")).toBeInTheDocument();
    expect(screen.getByText(/That private key isn’t Tester1/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Clear this window and continue/i })).not.toBeInTheDocument();
    expect(authScreenMocks.authKernel.importIdentityForBoundProfile).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText(/Use a different account in this window/i));
    expect(await screen.findByTestId("auth-account-switch-panel")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Clear this window and continue/i })).toBeInTheDocument();
    expect(screen.getByText(/This window holds Tester1/i)).toBeInTheDocument();
  });

  it("names the occupant from identity storage when profile store is empty", async () => {
    const occupant = "a".repeat(64);
    const differentPrivateKey = "c09832d637eb265d90b29c12eb8dfcfffe165b8fb34094af75236d5be4d97884" as PrivateKeyHex;
    expect(derivePublicKeyHex(differentPrivateKey)).not.toBe(occupant);

    vi.mocked(getLastBoundAccountPublicKeyHex).mockReturnValue(occupant as never);
    vi.mocked(readIdentityRecordFromLocalStorage).mockReturnValue({
      publicKeyHex: occupant,
      encryptedPrivateKey: "encrypted" as never,
      username: "DemoUser",
    } as never);

    // Simulate a lock-screen band where identity.state.stored is present but unnamed.
    authScreenMocks.identityState = {
      status: "locked",
      stored: {
        publicKeyHex: occupant,
      },
    };

    render(<AuthScreen />);
    await clickAuthLoginTab("Import Key");
    fireEvent.change(screen.getByPlaceholderText("nsec1..."), {
      target: { value: differentPrivateKey },
    });

    expect(await screen.findByTestId("auth-wrong-key-for-occupant")).toBeInTheDocument();
    expect(screen.getByText(/That private key isn’t DemoUser/i)).toBeInTheDocument();
  });

  it("keeps protect-your-identity note under About details (single copy)", async () => {
    render(<AuthScreen />);
    await clickAuthLoginTab("Import Key");
    expect(await screen.findByPlaceholderText("nsec1...")).toBeTruthy();
    fireEvent.click(screen.getByText(/About sign-in & privacy/i));
    expect(screen.getAllByText("Protect your identity")).toHaveLength(1);
  });

  it("surfaces retired-key warning before import continues", async () => {
    const privateKeyHex = "a".repeat(64) as PrivateKeyHex;
    const publicKeyHex = derivePublicKeyHex(privateKeyHex);
    markRetiredIdentityPublicKey({ publicKeyHex, profileId: "default" });

    render(<AuthScreen />);
    await clickAuthLoginTab("Import Key");
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
    expect(screen.getByRole("button", { name: "Unlock" })).toBeInTheDocument();
  });

  it("unlocks passwordless stored accounts with matching private key without forcing device password setup", async () => {
    vi.mocked(hasPasswordProtectedUnlockOnDevice).mockResolvedValueOnce(false);
    const privateKeyHex = "a".repeat(64) as PrivateKeyHex;
    const publicKeyHex = derivePublicKeyHex(privateKeyHex);
    authScreenMocks.identityState = {
      status: "locked",
      stored: {
        publicKeyHex,
        encryptedPrivateKey: PASSWORDLESS_NATIVE_ONLY_SENTINEL,
        username: "Tester2",
      },
    } as unknown as typeof authScreenMocks.identityState;

    render(<AuthScreen />);
    await clickAuthLoginTab("Import Key");
    fireEvent.change(screen.getByPlaceholderText("nsec1..."), {
      target: { value: privateKeyHex },
    });
    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));

    await waitFor(() => {
      expect(authScreenMocks.runtime.unlockBoundProfileWithPrivateKeyHex).toHaveBeenCalledWith({
        privateKeyHex,
        staySignedIn: expect.any(Boolean),
      });
    });
    expect(authScreenMocks.authKernel.importIdentityForBoundProfile).not.toHaveBeenCalled();
    expect(screen.queryByText("Set device login password")).not.toBeInTheDocument();
  });

  it("unlocks returning stored accounts with matching private key instead of re-importing", async () => {
    const privateKeyHex = "a".repeat(64) as PrivateKeyHex;
    const publicKeyHex = derivePublicKeyHex(privateKeyHex);
    authScreenMocks.identityState = {
      status: "locked",
      stored: {
        publicKeyHex,
        username: "Tester2",
      },
    };

    render(<AuthScreen />);
    await clickAuthLoginTab("Import Key");
    fireEvent.change(screen.getByPlaceholderText("nsec1..."), {
      target: { value: privateKeyHex },
    });
    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));

    await waitFor(() => {
      expect(authScreenMocks.runtime.unlockBoundProfileWithPrivateKeyHex).toHaveBeenCalledTimes(1);
    });
    expect(authScreenMocks.authKernel.importIdentityForBoundProfile).not.toHaveBeenCalled();
  });

  it("returns to welcome from restore when back is pressed", async () => {
    authScreenMocks.hasStoredIdentity = false;
    authScreenMocks.identityState = {
      status: "locked",
      stored: undefined,
    } as unknown as typeof authScreenMocks.identityState;
    authScreenMocks.runtime.snapshot.session.startupState.kind = "no_identity";
    authScreenMocks.runtime.snapshot.session.startupState.storedPublicKeyHex = undefined;

    render(<AuthScreen />);

    fireEvent.click(await screen.findByRole("button", { name: "Restore from backup" }));
    expect(await screen.findByText("Restore account")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Back"));

    expect(await screen.findByText("Create New Identity")).toBeInTheDocument();
    expect(screen.queryByText("Restore account")).not.toBeInTheDocument();
  });

  it("opens a new profile window instead of in-window create when the desktop slot is occupied", async () => {
    vi.mocked(requiresFreshProfileWindowForGreenfieldAuth).mockReturnValue(true);
    authScreenMocks.isNativeRuntime = true;
    authScreenMocks.hasStoredIdentity = false;
    authScreenMocks.identityState = {
      status: "locked",
      stored: undefined,
    } as unknown as typeof authScreenMocks.identityState;
    authScreenMocks.runtime.snapshot.session.startupState.kind = "no_identity";
    authScreenMocks.runtime.snapshot.session.startupState.storedPublicKeyHex = undefined;

    render(<AuthScreen />);

    fireEvent.click(await screen.findByText("Create New Identity"));

    await waitFor(() => {
      expect(openFreshProfileWindowForSignIn).toHaveBeenCalledWith("New identity");
    });
    expect(screen.queryByText("Pick a Name")).not.toBeInTheDocument();
  });

  it("opens a new profile window instead of in-window restore when the desktop slot is occupied", async () => {
    vi.mocked(requiresFreshProfileWindowForGreenfieldAuth).mockReturnValue(true);
    authScreenMocks.isNativeRuntime = true;
    authScreenMocks.hasStoredIdentity = false;
    authScreenMocks.identityState = {
      status: "locked",
      stored: undefined,
    } as unknown as typeof authScreenMocks.identityState;
    authScreenMocks.runtime.snapshot.session.startupState.kind = "no_identity";
    authScreenMocks.runtime.snapshot.session.startupState.storedPublicKeyHex = undefined;

    render(<AuthScreen />);

    fireEvent.click(await screen.findByRole("button", { name: "Restore from backup" }));

    await waitFor(() => {
      expect(openFreshProfileWindowForSignIn).toHaveBeenCalledWith("Restore backup");
    });
    expect(screen.queryByText("Restore account")).not.toBeInTheDocument();
  });

  it("keeps create in the current window when the desktop slot is empty", async () => {
    vi.mocked(requiresFreshProfileWindowForGreenfieldAuth).mockReturnValue(false);
    authScreenMocks.isNativeRuntime = true;
    authScreenMocks.hasStoredIdentity = false;
    authScreenMocks.identityState = {
      status: "locked",
      stored: undefined,
    } as unknown as typeof authScreenMocks.identityState;
    authScreenMocks.runtime.snapshot.session.startupState.kind = "no_identity";
    authScreenMocks.runtime.snapshot.session.startupState.storedPublicKeyHex = undefined;

    render(<AuthScreen />);

    fireEvent.click(await screen.findByText("Create New Identity"));

    expect(await screen.findByText("Pick a Name")).toBeInTheDocument();
    expect(openFreshProfileWindowForSignIn).not.toHaveBeenCalled();
  });

  it("allows create after generate, manual password change, and confirm re-entry", async () => {
    authScreenMocks.hasStoredIdentity = false;
    authScreenMocks.identityState = {
      status: "locked",
      stored: undefined,
    } as unknown as typeof authScreenMocks.identityState;
    authScreenMocks.runtime.snapshot.session.startupState.kind = "no_identity";
    authScreenMocks.runtime.snapshot.session.startupState.storedPublicKeyHex = undefined;

    render(<AuthScreen />);

    fireEvent.click(await screen.findByText("Create New Identity"));
    fireEvent.change(screen.getByPlaceholderText("e.g. Satoshi"), {
      target: { value: "tester" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    fireEvent.click(await screen.findByRole("button", { name: "Generate Code" }));

    const passwordInput = screen.getByPlaceholderText("Create a strong password") as HTMLInputElement;
    const confirmInput = screen.getByPlaceholderText("Repeat your password") as HTMLInputElement;

    expect(passwordInput.value).not.toBe("");
    expect(confirmInput.value).toBe(passwordInput.value);

    fireEvent.change(passwordInput, {
      target: { value: "ManualPassphrase#2026" },
    });

    await waitFor(() => {
      expect((screen.getByPlaceholderText("Repeat your password") as HTMLInputElement).value).toBe("");
    });

    fireEvent.change(screen.getByPlaceholderText("Repeat your password"), {
      target: { value: "ManualPassphrase#2026" },
    });

    fireEvent.click(screen.getByRole("checkbox", { name: /i understand i am responsible for my keys/i }));
    fireEvent.click(screen.getByRole("button", { name: "Continue to backup" }));
    fireEvent.click(await screen.findByRole("checkbox", { name: /i will keep the recovery file/i }));
    vi.mocked(readIdentityRecordFromLocalStorage).mockReturnValue({
      publicKeyHex: "a".repeat(64),
      encryptedPrivateKey: JSON.stringify({ v: 2, ciphertextB64: "cipher" }),
      username: "tester",
    } as never);
    fireEvent.click(screen.getByRole("button", { name: "Generate Safe Identity" }));

    await waitFor(() => {
      expect(authScreenMocks.authKernel.createIdentityForBoundProfile).toHaveBeenCalledTimes(1);
    });
    expect(authScreenMocks.authKernel.createIdentityForBoundProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        username: "tester",
        passphrase: "ManualPassphrase#2026",
      }),
    );
  });

  it("blocks manual create passwords shorter than the identity policy and explains why", async () => {
    authScreenMocks.hasStoredIdentity = false;
    authScreenMocks.identityState = {
      status: "locked",
      stored: undefined,
    } as unknown as typeof authScreenMocks.identityState;
    authScreenMocks.runtime.snapshot.session.startupState.kind = "no_identity";
    authScreenMocks.runtime.snapshot.session.startupState.storedPublicKeyHex = undefined;

    render(<AuthScreen />);

    fireEvent.click(await screen.findByText("Create New Identity"));
    fireEvent.change(screen.getByPlaceholderText("e.g. Satoshi"), {
      target: { value: "tester" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    fireEvent.change(screen.getByPlaceholderText("Create a strong password"), {
      target: { value: "sue76#s1B" },
    });
    fireEvent.change(screen.getByPlaceholderText("Repeat your password"), {
      target: { value: "sue76#s1B" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: /i understand i am responsible for my keys/i }));

    const submitButton = screen.getByRole("button", { name: "Continue to backup" });
    expect(submitButton).toBeDisabled();
    expect(screen.getAllByText(/Use at least 12 characters, or a passphrase of four or more words/i).length).toBeGreaterThan(0);
    expect(authScreenMocks.authKernel.createIdentityForBoundProfile).not.toHaveBeenCalled();
  });

  it("allows create with a manual password that meets the identity policy", async () => {
    authScreenMocks.hasStoredIdentity = false;
    authScreenMocks.identityState = {
      status: "locked",
      stored: undefined,
    } as unknown as typeof authScreenMocks.identityState;
    authScreenMocks.runtime.snapshot.session.startupState.kind = "no_identity";
    authScreenMocks.runtime.snapshot.session.startupState.storedPublicKeyHex = undefined;

    render(<AuthScreen />);

    fireEvent.click(await screen.findByText("Create New Identity"));
    fireEvent.change(screen.getByPlaceholderText("e.g. Satoshi"), {
      target: { value: "tester" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    fireEvent.change(screen.getByPlaceholderText("Create a strong password"), {
      target: { value: "MyManualPass#2026" },
    });
    fireEvent.change(screen.getByPlaceholderText("Repeat your password"), {
      target: { value: "MyManualPass#2026" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: /i understand i am responsible for my keys/i }));
    fireEvent.click(screen.getByRole("button", { name: "Continue to backup" }));
    fireEvent.click(await screen.findByRole("checkbox", { name: /i will keep the recovery file/i }));
    vi.mocked(readIdentityRecordFromLocalStorage).mockReturnValue({
      publicKeyHex: "a".repeat(64),
      encryptedPrivateKey: JSON.stringify({ v: 2, ciphertextB64: "cipher" }),
      username: "tester",
    } as never);
    fireEvent.click(screen.getByRole("button", { name: "Generate Safe Identity" }));

    await waitFor(() => {
      expect(authScreenMocks.authKernel.createIdentityForBoundProfile).toHaveBeenCalledTimes(1);
    });
    expect(authScreenMocks.authKernel.createIdentityForBoundProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        username: "tester",
        passphrase: "MyManualPass#2026",
      }),
    );
  });

  it("stays on Auth for device-password bind when Advanced key unlock leaves native storage closed", async () => {
    const { toast } = await import("@dweb/ui-kit/toast");
    const privateKeyHex = "a".repeat(64) as PrivateKeyHex;
    const publicKeyHex = derivePublicKeyHex(privateKeyHex);
    authScreenMocks.isNativeRuntime = true;
    authScreenMocks.identityState = {
      status: "locked",
      stored: {
        publicKeyHex,
        username: "Tester1",
      },
    };
    storageAtRestMocks.restoreNativeVaultEncryptionSessionIfNeeded.mockResolvedValueOnce(false);
    storageAtRestMocks.ensureNativeSqliteOpenForWrites.mockResolvedValueOnce(false);
    authScreenMocks.runtime.unlockBoundProfileWithPrivateKeyHex.mockImplementation(async () => {
      authScreenMocks.identityState = {
        status: "unlocked",
        publicKeyHex,
        stored: { publicKeyHex, username: "Tester1" },
        privateKeyHex,
      } as unknown as typeof authScreenMocks.identityState;
    });

    render(<AuthScreen />);
    await clickAuthLoginTab("Import Key");
    fireEvent.change(screen.getByPlaceholderText("nsec1..."), {
      target: { value: privateKeyHex },
    });
    await invokeReactClick(screen.getByRole("button", { name: "Unlock" }));

    expect(await screen.findByTestId("auth-device-password-bind")).toBeInTheDocument();
    expect(screen.getByText(/Device password for this computer/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Open chat on this device/i })).toBeInTheDocument();
    expect(screen.queryByText(/Skip — unlock with key only/i)).not.toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalledWith("Welcome Back!");
  });

  it("restores device-password bind UI from module pending after remount (unlock-loop FM1)", async () => {
    const { setDevicePasswordBindPending } = await import(
      "@/app/features/auth/services/device-password-bind-pending"
    );
    const privateKeyHex = "a".repeat(64) as PrivateKeyHex;
    const publicKeyHex = derivePublicKeyHex(privateKeyHex);
    authScreenMocks.isNativeRuntime = true;
    vi.mocked(hasPasswordProtectedUnlockOnDevice).mockResolvedValue(true);
    setDevicePasswordBindPending(true);
    authScreenMocks.identityState = {
      status: "unlocked",
      publicKeyHex,
      stored: { publicKeyHex, username: "Tester1" },
      privateKeyHex,
    } as unknown as typeof authScreenMocks.identityState;

    render(<AuthScreen />);

    expect(await screen.findByTestId("auth-device-password-bind")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Open chat on this device/i })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Enter your password")).not.toBeInTheDocument();
  });

  it("Welcome Back after Advanced key when keychain PDK restore succeeds (Slice C)", async () => {
    const { toast } = await import("@dweb/ui-kit/toast");
    const privateKeyHex = "a".repeat(64) as PrivateKeyHex;
    const publicKeyHex = derivePublicKeyHex(privateKeyHex);
    authScreenMocks.isNativeRuntime = true;
    authScreenMocks.identityState = {
      status: "locked",
      stored: {
        publicKeyHex,
        username: "Tester1",
      },
    };
    storageAtRestMocks.restoreNativeVaultEncryptionSessionIfNeeded.mockResolvedValueOnce(true);
    authScreenMocks.runtime.unlockBoundProfileWithPrivateKeyHex.mockImplementation(async () => {
      authScreenMocks.identityState = {
        status: "unlocked",
        publicKeyHex,
        stored: { publicKeyHex, username: "Tester1" },
        privateKeyHex,
      } as unknown as typeof authScreenMocks.identityState;
    });

    render(<AuthScreen />);
    await clickAuthLoginTab("Import Key");
    fireEvent.change(screen.getByPlaceholderText("nsec1..."), {
      target: { value: privateKeyHex },
    });
    await invokeReactClick(screen.getByRole("button", { name: "Unlock" }));

    await waitFor(() => {
      expect(storageAtRestMocks.restoreNativeVaultEncryptionSessionIfNeeded).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Welcome Back!");
    });
    expect(screen.queryByTestId("auth-device-password-bind")).not.toBeInTheDocument();
    expect(storageAtRestMocks.ensureNativeSqliteOpenForWrites).not.toHaveBeenCalled();
  });

  it("keeps Advanced collapsed after passphrase primary probe (Slice B)", async () => {
    vi.mocked(hasPasswordProtectedUnlockOnDevice).mockResolvedValue(true);
    render(<AuthScreen />);

    expect(await screen.findByPlaceholderText("Enter your password")).toBeTruthy();
    expect(screen.queryByPlaceholderText("nsec1...")).not.toBeInTheDocument();
    expect(screen.getByText(/Advanced: unlock with private key/i)).toBeTruthy();
  });

});

