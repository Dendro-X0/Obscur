"use client";

import React, { useState, useCallback, useRef } from "react";
import Image from "next/image";
import {
    UserPlus,
    LogIn,
    ArrowRight,
    Shield,
    User,
    Lock,
    Eye,
    EyeOff,
    ChevronLeft,
    CheckCircle2,
    Sparkles,
    Key,
    UserCheck,
    ArchiveRestore,
    AlertCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@dweb/ui-kit";
import { Input } from "@dweb/ui-kit";
import { Card } from "@dweb/ui-kit";
import { Label } from "@dweb/ui-kit";
import { cn } from "@/app/lib/utils";
import { useIdentity } from "../hooks/use-identity";
import { useTranslation } from "react-i18next";
import { toast } from "@dweb/ui-kit";
import type { Passphrase } from "@dweb/crypto/passphrase";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import { derivePublicKeyHex } from "@dweb/crypto/derive-public-key-hex";
import { decodePrivateKey } from "../utils/decode-private-key";
import { LanguageSelector } from "@/app/components/language-selector";
import { useProfile } from "@/app/features/profile/hooks/use-profile";
import { Checkbox } from "@dweb/ui-kit";
import { FlashMessage } from "@/app/components/ui/flash-message";
import { PasswordStrengthIndicator } from "@/app/components/password-strength-indicator";
import { revokeDeviceTrust } from "../services/device-trust-service";
import { SESSION_CREDENTIAL_PERSISTENCE_ENABLED } from "../services/session-credential-policy";
import { AuthSessionPolicyNotice } from "./auth-session-policy-notice";
import { useWindowRuntime } from "@/app/features/runtime/services/window-runtime-supervisor";
import {
    shouldEnterLoginModeOnStartup,
    startupAuthStateHasPrivateKeyMismatch,
    startupAuthStateHasStoredIdentity,
} from "@/app/features/auth/services/startup-auth-state-contracts";
import { generateRandomInviteCode } from "@/app/features/invites/utils/invite-code-format";
import { logAppEvent } from "@/app/shared/log-app-event";
import { isRetiredIdentityPublicKey } from "../utils/retired-identity-registry";
import { AuthScreenRestorePage } from "@/app/features/profiles/components/auth-screen-restore-page";
import { AccountActiveInOtherProfileInline } from "@/app/features/profiles/components/account-active-in-other-profile-inline";
import { ProfileSlotAccountConflictInline } from "@/app/features/profiles/components/profile-slot-account-conflict-inline";
import {
  AccountActiveInOtherProfileWindowError,
} from "@/app/features/profiles/services/cross-profile-active-session-lease";
import {
  AUTH_CLIENT_REVISION,
  profileWindowHasLocalAccountEvidence,
} from "@/app/features/auth/services/auth-profile-local-evidence";
import {
  clearProfileSlotForDifferentAccount,
  openFreshProfileWindowForSignIn,
} from "@/app/features/profiles/services/profile-slot-account-switch";
import {
  ProfileSlotAccountConflictError,
  type ProfileSlotLoginAttemptResult,
} from "@/app/features/profiles/services/profile-slot-login-guard";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { ProfileArchiveResultInline } from "@/app/features/profiles/components/profile-archive-result-inline";

type PendingAuthAction = Readonly<
  | {
    kind: "import_key";
    privateKeyHex: PrivateKeyHex;
    passphrase: Passphrase;
    username?: string;
  }
  | {
    kind: "create";
    passphrase: Passphrase;
    username: string;
  }
>;

const generateSecurePassword = (): string => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+~`|}{[]:;?><,./-=";
    let result = "";
    const randomArray = new Uint32Array(16);
    window.crypto.getRandomValues(randomArray);
    for (let i = 0; i < 16; i++) {
        result += chars[randomArray[i] % chars.length];
    }
    return result;
};

const normalizeLoginUsername = (value: string): string => value.trim().toLowerCase();

type AuthMode = "welcome" | "create" | "login" | "restore";

export function AuthScreen() {
    const { t } = useTranslation();
    const identity = useIdentity();
    const runtime = useWindowRuntime();
    const startupState = runtime.snapshot.session.startupState;
    const profile = useProfile();
    const boundProfileId = runtime.snapshot.session.profileId;
    const hasNativeMismatch = startupState.mismatchReason === "native_mismatch";
    const hasStoredIdentity = startupAuthStateHasStoredIdentity(startupState)
        || Boolean(identity.state.stored?.publicKeyHex);
    const hasLocalAccountEvidence = hasStoredIdentity
        || profileWindowHasLocalAccountEvidence(boundProfileId);
    const authSurfaceReady = startupState.kind !== "pending" && identity.state.status !== "loading";

    const [mode, setMode] = useState<AuthMode>("welcome");
    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [loginTab, setLoginTab] = useState<"username" | "key">("username");
    const [authError, setAuthError] = useState<string | null>(null);
    const hasPrivateKeyMismatch = startupAuthStateHasPrivateKeyMismatch(startupState)
        || authError?.toLowerCase().includes("does not match stored identity") === true;
    const [acknowledged, setAcknowledged] = useState(false);
    const [retiredKeyReuseAcknowledged, setRetiredKeyReuseAcknowledged] = useState(false);
    const [accountConflict, setAccountConflict] = useState<
      Extract<ProfileSlotLoginAttemptResult, { status: "blocked_different_account" }> | null
    >(null);
    const [activeSessionConflict, setActiveSessionConflict] = useState<
      AccountActiveInOtherProfileWindowError["detail"] | null
    >(null);
    const [pendingAuthAction, setPendingAuthAction] = useState<PendingAuthAction | null>(null);
    const [isConflictBusy, setIsConflictBusy] = useState(false);
    const [lastArchiveResult, setLastArchiveResult] = useState<{
      fileName: string;
      absolutePath: string | null;
      downloadTriggered: boolean;
    } | null>(null);
    const keyOwnershipReminder = t(
        "auth.keyOwnershipReminder",
        "You own your private key. Obscur cannot recover accounts for lost keys or forgotten passwords."
    );
    const keyRecoveryReminder = t(
        "auth.keyRecoveryReminder",
        "Back up your private key now and verify export in Settings > Identity after login."
    );

    // Form states
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [privateKey, setPrivateKey] = useState("");
    const decodedImportPrivateKey = React.useMemo(() => decodePrivateKey(privateKey), [privateKey]);
    const importCandidatePublicKeyHex = React.useMemo(() => {
        if (!decodedImportPrivateKey) {
            return null;
        }
        try {
            return derivePublicKeyHex(decodedImportPrivateKey as PrivateKeyHex);
        } catch {
            return null;
        }
    }, [decodedImportPrivateKey]);
    const isRetiredImportKey = importCandidatePublicKeyHex
        ? isRetiredIdentityPublicKey(importCandidatePublicKeyHex)
        : false;
    const hasAppliedInitialEntryRouteRef = useRef(false);

    const boundProfileLabel = runtime.snapshot.session.profileLabel ?? boundProfileId;
    const storedUsernameHint = identity.state.stored?.username?.trim();

    React.useEffect(() => {
        if (!SESSION_CREDENTIAL_PERSISTENCE_ENABLED) {
            revokeDeviceTrust(boundProfileId);
        }
    }, [boundProfileId]);

    React.useEffect(() => {
        if (hasAppliedInitialEntryRouteRef.current) {
            return;
        }
        if (startupState.kind === "pending" || identity.state.status === "loading") {
            return;
        }
        hasAppliedInitialEntryRouteRef.current = true;
        if (shouldEnterLoginModeOnStartup(startupState) || hasStoredIdentity || hasLocalAccountEvidence) {
            setMode("login");
            if (hasStoredIdentity) {
                setLoginTab("username");
            } else if (!hasLocalAccountEvidence) {
                setLoginTab("key");
            }
        }
    }, [hasLocalAccountEvidence, hasStoredIdentity, identity.state.status, identity.state.stored?.publicKeyHex, startupState]);

    const handleBack = () => {
        if (step > 1) {
            setStep(step - 1);
        } else {
            setMode("welcome");
            resetForm();
        }
    };

    const handleResetNativeSecureStorage = useCallback(async () => {
        if (!identity.resetNativeSecureStorage) {
            setAuthError(t("auth.error.secureStorageResetUnavailable", "Secure storage reset is not available in this runtime."));
            return;
        }
        setIsLoading(true);
        setAuthError(null);
        try {
            await identity.resetNativeSecureStorage();
            toast.success(t("auth.secureStorageResetSuccess", "Secure storage reset. You can now unlock this profile manually."));
        } catch (error) {
            setAuthError(error instanceof Error ? error.message : t("auth.error.secureStorageResetFailed", "Failed to reset secure storage"));
        } finally {
            setIsLoading(false);
        }
    }, [identity]);

    const resetForm = () => {
        setStep(1);
        setUsername("");
        setPassword("");
        setConfirmPassword("");
        setPrivateKey("");
        setAuthError(null);
        setAcknowledged(false);
        setRetiredKeyReuseAcknowledged(false);
    };

    const handleContinueImportKey = async (): Promise<void> => {
        setAuthError(null);
        const keyToUse = decodedImportPrivateKey;
        if (!keyToUse) {
            setAuthError(t("auth.error.invalidPrivateKeyFormat", "Invalid private key. Enter a valid `nsec` or 64-character hex key."));
            return;
        }
        if (isRetiredImportKey && !retiredKeyReuseAcknowledged) {
            setAuthError(t("auth.error.retiredKeyRequiresAcknowledgement", "This private key was previously retired on this device. Confirm reactivation before continuing."));
            return;
        }
        await handleLoginFinal(undefined, true);
    };

    const runCreateIdentity = async (action: Extract<PendingAuthAction, { kind: "create" }>): Promise<void> => {
        await runtime.createIdentityForBoundProfile({
            passphrase: action.passphrase,
            username: action.username,
        });
        const inviteCode = generateRandomInviteCode();
        profile.setUsername({ username: action.username });
        profile.setInviteCode({ inviteCode });
        profile.save();
        toast.success(t("auth.identitySecured", "Identity Secured!"));
    };

    const runImportKeyLogin = async (action: Extract<PendingAuthAction, { kind: "import_key" }>): Promise<void> => {
        await runtime.importIdentityForBoundProfile({
            privateKeyHex: action.privateKeyHex,
            passphrase: action.passphrase,
            username: action.username,
        });
        toast.info(t("auth.keyAcceptedRestoringData", "Key accepted. Restoring account data..."));
    };

    const retryPendingAuthAction = async (): Promise<void> => {
        if (!pendingAuthAction) {
            return;
        }
        if (pendingAuthAction.kind === "import_key") {
            await runImportKeyLogin(pendingAuthAction);
            return;
        }
        await runCreateIdentity(pendingAuthAction);
    };

    const handleAccountConflictError = (error: unknown, pending: PendingAuthAction): boolean => {
        if (error instanceof AccountActiveInOtherProfileWindowError) {
            setActiveSessionConflict(error.detail);
            setAccountConflict(null);
            setPendingAuthAction(pending);
            setAuthError(error.message);
            return true;
        }
        if (!(error instanceof ProfileSlotAccountConflictError)) {
            return false;
        }
        setActiveSessionConflict(null);
        setAccountConflict(error.detail);
        setPendingAuthAction(pending);
        return true;
    };

    const handleCreateFinal = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!password || password !== confirmPassword) {
            setAuthError(t("auth.error.passwordsDoNotMatch", "Passwords do not match"));
            return;
        }
        if (password.length < 8) {
            setAuthError(t("auth.error.passwordTooShort", "Password must be at least 8 characters"));
            return;
        }

        const pending: PendingAuthAction = {
            kind: "create",
            passphrase: password as Passphrase,
            username: username.trim(),
        };

        setIsLoading(true);
        try {
            await runCreateIdentity(pending);
        } catch (error) {
            if (!handleAccountConflictError(error, pending)) {
                setAuthError(error instanceof Error ? error.message : t("auth.error.createAccountFailed", "Failed to create account"));
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleLoginUsername = async (e?: React.FormEvent) => {
        e?.preventDefault();
        const enteredUsername = username.trim();
        if (!enteredUsername || !password) {
            setAuthError(t("auth.error.fillAllFields", "Please fill in all fields"));
            return;
        }

        setIsLoading(true);
        try {
            const stored = identity.state.stored;
            if (!stored) {
                setAuthError(t("auth.error.noLocalAccountYet", "No local account exists on this device yet. Import your private key first, then you can use username/password unlock locally."));
                setLoginTab("key");
                setIsLoading(false);
                return;
            }
            // Username is a convenience hint. Password/private-key proof remains canonical.
            // Some legacy/imported identities do not persist a username and should still unlock.
            const storedUsername = stored.username?.trim();
            const normalizedEnteredUsername = normalizeLoginUsername(enteredUsername);
            const normalizedStoredUsername = storedUsername ? normalizeLoginUsername(storedUsername) : null;
            if (normalizedStoredUsername && normalizedStoredUsername !== normalizedEnteredUsername) {
                toast.info(t("auth.error.usernameMismatch"));
            }

            try {
                await runtime.unlockBoundProfile({ passphrase: password as Passphrase });
            } catch (e) {
                if (
                    e instanceof ProfileSlotAccountConflictError
                    || e instanceof AccountActiveInOtherProfileWindowError
                ) {
                    throw e;
                }
                setAuthError(t("auth.error.incorrectPassword"));
                setIsLoading(false);
                return;
            }
            toast.success(t("auth.welcomeBackToast", "Welcome Back!"));
        } catch (error) {
            setAuthError(error instanceof Error ? error.message : t("auth.error.invalidPasswordOrAccount", "Invalid password or account error"));
        } finally {
            setIsLoading(false);
        }
    };

    const handleLoginFinal = async (e?: React.FormEvent, skipPassword = false) => {
        e?.preventDefault();

        const providedPassword = skipPassword ? "" : password;
        const importPassphrase = providedPassword;

        if (!privateKey) {
            setAuthError(t("auth.error.privateKeyRequired", "Private key is required"));
            return;
        }

        if (!skipPassword && !password) {
            setAuthError(t("auth.error.enterPasswordOrSkip", "Please enter a password or skip"));
            return;
        }

        setIsLoading(true);
        let keyToUse: string | null = null;
        try {
            keyToUse = decodePrivateKey(privateKey);
            if (!keyToUse) {
                setAuthError(t("auth.error.invalidKeyFormat", "Invalid key format"));
                setIsLoading(false);
                return;
            }
            const importPublicKeyHex = derivePublicKeyHex(keyToUse as PrivateKeyHex);
            if (isRetiredIdentityPublicKey(importPublicKeyHex) && !retiredKeyReuseAcknowledged) {
                setAuthError(t("auth.error.retiredKeyImportRequiresAcknowledgement", "This private key was previously retired on this device. Confirm reactivation before importing."));
                setStep(1);
                setIsLoading(false);
                return;
            }

            const pending: PendingAuthAction = {
                kind: "import_key",
                privateKeyHex: keyToUse as PrivateKeyHex,
                passphrase: (importPassphrase || "") as Passphrase,
                username: username || undefined,
            };

            await runImportKeyLogin(pending);
        } catch (error) {
            if (keyToUse) {
                const pending: PendingAuthAction = {
                    kind: "import_key",
                    privateKeyHex: keyToUse as PrivateKeyHex,
                    passphrase: (importPassphrase || "") as Passphrase,
                    username: username || undefined,
                };
                if (handleAccountConflictError(error, pending)) {
                    return;
                }
            }
            setAuthError(error instanceof Error ? error.message : t("auth.error.importKeyFailed", "Failed to import key"));
        } finally {
            setIsLoading(false);
        }
    };

    const clearWindowAndRetryLogin = async (exportArchiveFirst: boolean): Promise<void> => {
        if (!accountConflict || !pendingAuthAction) {
            return;
        }
        setIsConflictBusy(true);
        try {
            const archiveResult = await clearProfileSlotForDifferentAccount({
                profileId: accountConflict.profileId,
                previousPublicKeyHex: accountConflict.occupantPublicKeyHex,
                exportArchiveFirst,
                profileLabel: boundProfileLabel,
            });
            if (archiveResult) {
                setLastArchiveResult(archiveResult);
            }
            await identity.forgetIdentity();
            setAccountConflict(null);
            setIsLoading(true);
            await retryPendingAuthAction();
            setPendingAuthAction(null);
        } catch (error) {
            setAuthError(error instanceof Error ? error.message : "Could not reset this profile window.");
        } finally {
            setIsConflictBusy(false);
            setIsLoading(false);
        }
    };

    const handleOpenAnotherProfileWindow = async (): Promise<void> => {
        setIsConflictBusy(true);
        try {
            await openFreshProfileWindowForSignIn();
            toast.success("Opened a new profile window. Sign in with the other account there.");
            setAccountConflict(null);
            setPendingAuthAction(null);
        } catch (error) {
            setAuthError(error instanceof Error ? error.message : "Could not open another profile window.");
        } finally {
            setIsConflictBusy(false);
        }
    };

    const variants = {
        enter: (direction: number) => ({
            x: direction > 0 ? 50 : -50,
            opacity: 0,
            scale: 0.98
        }),
        center: {
            zIndex: 1,
            x: 0,
            opacity: 1,
            scale: 1
        },
        exit: (direction: number) => ({
            zIndex: 0,
            x: direction < 0 ? 50 : -50,
            opacity: 0,
            scale: 0.98
        })
    };

    if (mode === "login" && !authSurfaceReady) {
        return (
            <div className="relative flex flex-1 items-center justify-center p-4">
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                    Loading profile auth ({AUTH_CLIENT_REVISION})…
                </p>
            </div>
        );
    }

    return (
        <div className="relative flex-1 flex items-center justify-center p-4 overflow-y-auto z-[80]">
            <div className="absolute top-6 right-6 z-[160]">
                <LanguageSelector variant="minimal" />
            </div>

            {/* Background elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <motion.div
                    animate={{
                        scale: [1, 1.1, 1],
                        opacity: [0.1, 0.15, 0.1]
                    }}
                    transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] bg-purple-500/10 rounded-full blur-[120px]"
                />
                <motion.div
                    animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.1, 0.12, 0.1]
                    }}
                    transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 2 }}
                    className="absolute -bottom-[20%] -right-[10%] w-[70%] h-[70%] bg-blue-500/10 rounded-full blur-[120px]"
                />
            </div>

            <Card className="w-full max-w-lg relative bg-white/40 dark:bg-zinc-900/40 backdrop-blur-3xl border-0 ring-1 ring-black/[0.05] dark:ring-white/[0.05] rounded-[48px] shadow-2xl overflow-hidden p-0">
                <div className="p-8 sm:p-12 min-h-[500px] flex flex-col justify-center">
                    {hasNativeMismatch && (
                        <div className="mb-6 rounded-[28px] border border-amber-500/20 bg-amber-500/10 p-5">
                            <div className="flex items-start gap-4">
                                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                                <div className="min-w-0 flex-1 space-y-3">
                                    <div>
                                        <p className="text-sm font-black uppercase tracking-[0.16em] text-amber-600 dark:text-amber-400">
                                            {t("auth.secureStorageRecoveryTitle", "Secure Storage Needs Recovery")}
                                        </p>
                                        <p className="mt-2 text-sm font-medium leading-relaxed text-amber-700 dark:text-amber-200">
                                            {startupState.message ?? t("auth.secureStorageRecoveryDesc", "Native auto-unlock was skipped for this profile.")}
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap gap-3">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={handleResetNativeSecureStorage}
                                            disabled={isLoading}
                                            className="rounded-2xl border-amber-500/30 bg-white/70 text-amber-700 hover:bg-white dark:bg-zinc-950/30 dark:text-amber-300"
                                        >
                                            {t("auth.resetSecureStorage", "Reset Secure Storage")}
                                        </Button>
                                        <p className="self-center text-xs font-semibold text-amber-700/80 dark:text-amber-300/80">
                                            {t("auth.secureStorageRecoveryHint", "You can also continue with your password or private key below.")}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    {mode === "login" && hasPrivateKeyMismatch && (
                        <div className="mb-6 rounded-[28px] border border-orange-500/20 bg-orange-500/10 p-5">
                            <div className="flex items-start gap-4">
                                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-orange-500" />
                                <div className="min-w-0 flex-1 space-y-3">
                                    <div>
                                        <p className="text-sm font-black uppercase tracking-[0.16em] text-orange-600 dark:text-orange-400">
                                            {t("auth.privateKeyMismatchTitle", "Private Key Mismatch")}
                                        </p>
                                        <p className="mt-2 text-sm font-medium leading-relaxed text-orange-700 dark:text-orange-200">
                                            {startupState.message ?? authError ?? t("auth.privateKeyMismatchDesc", "The entered private key does not match the account stored on this profile.")}
                                        </p>
                                    </div>
                                    <p className="text-xs font-semibold text-orange-700/80 dark:text-orange-300/80">
                                        {t("auth.privateKeyMismatchHint", "Import the correct key for this profile, or switch to the intended account before continuing.")}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                    <AnimatePresence mode="wait">
                        {mode !== "welcome" && (
                            <motion.button
                                key="back-button"
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                onClick={handleBack}
                                className="absolute top-8 left-8 p-3 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 group"
                            >
                                <ChevronLeft className="h-6 w-6 group-hover:-translate-x-0.5 transition-transform" />
                            </motion.button>
                        )}
                    </AnimatePresence>

                    <AnimatePresence mode="wait" custom={step}>
                        {mode === "welcome" && (
                            <motion.div
                                key={hasStoredIdentity ? "welcome-returning" : "welcome-new"}
                                initial="enter"
                                animate="center"
                                exit="exit"
                                variants={variants}
                                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                className="flex flex-col items-center text-center space-y-10"
                            >
                                <div className="relative group">
                                    <div className="absolute -inset-6 bg-gradient-to-tr from-purple-500 to-blue-500 rounded-[36px] blur-3xl opacity-20 group-hover:opacity-40 transition duration-1000" />
                                    <div className="relative h-24 w-24 rounded-[32px] bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/5 flex items-center justify-center shadow-2xl overflow-hidden">
                                        <Image src="/obscur-logo-light.svg" alt="Obscur Logo" width={64} height={64} className="dark:hidden" priority />
                                        <Image src="/obscur-logo-dark.svg" alt="Obscur Logo" width={64} height={64} className="hidden dark:block" priority />
                                    </div>
                                </div>

                                {hasStoredIdentity ? (
                                    <>
                                        <div className="space-y-3">
                                            <h1 className="text-4xl font-black tracking-tighter text-zinc-900 dark:text-white">
                                                {t("auth.welcome.returning.title", "Welcome back")}
                                            </h1>
                                            <p className="text-zinc-500 dark:text-zinc-400 text-base font-medium tracking-tight max-w-[320px] mx-auto leading-relaxed">
                                                {storedUsernameHint
                                                    ? t("auth.welcome.returning.subtitleNamed", "Unlock {{username}} on this device to open your messenger.", { username: storedUsernameHint })
                                                    : t("auth.welcome.returning.subtitle", "Your identity is on this device. Unlock to open your messenger.")}
                                            </p>
                                        </div>

                                        <div className="w-full max-w-md space-y-4 pt-2 text-left">
                                            <AuthSessionPolicyNotice variant="card" />
                                            <Button
                                                onClick={() => {
                                                    setLoginTab("username");
                                                    setMode("login");
                                                }}
                                                className="h-16 w-full rounded-[24px] bg-blue-600 hover:bg-blue-700 text-white text-lg font-bold shadow-xl shadow-blue-500/20"
                                            >
                                                {t("auth.welcome.returning.unlock", "Unlock")}
                                                <ArrowRight className="h-5 w-5 ml-2" />
                                            </Button>
                                            <Button
                                                variant="outline"
                                                onClick={() => {
                                                    setLoginTab("key");
                                                    setMode("login");
                                                }}
                                                className="h-14 w-full rounded-[24px] border-black/10 dark:border-white/10 bg-white/50 hover:bg-black/5 dark:bg-zinc-900/50 dark:hover:bg-white/5 text-base font-bold"
                                            >
                                                {t("auth.welcome.returning.useKey", "Log in with private key")}
                                            </Button>
                                            <button
                                                type="button"
                                                onClick={() => setMode("create")}
                                                className="w-full pt-2 text-xs font-semibold text-zinc-500 underline-offset-4 hover:text-zinc-700 hover:underline dark:text-zinc-400 dark:hover:text-zinc-200"
                                            >
                                                {t("auth.welcome.returning.createAnother", "Create a new identity instead")}
                                            </button>
                                            <Button
                                                variant="outline"
                                                onClick={() => setMode("restore")}
                                                className="h-12 w-full rounded-[24px] border-black/10 dark:border-white/10 bg-white/50 hover:bg-black/5 dark:bg-zinc-900/50 dark:hover:bg-white/5 text-sm font-bold"
                                            >
                                                <ArchiveRestore className="h-4 w-4" />
                                                {t("auth.welcome.restoreBackup", "Restore from backup")}
                                            </Button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="space-y-4">
                                            <h1 className="text-5xl font-black bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-500 dark:from-white dark:via-zinc-200 dark:to-zinc-500 bg-clip-text text-transparent tracking-tighter leading-tight">
                                                Obscur
                                            </h1>
                                            <p className="text-zinc-500 dark:text-zinc-400 text-lg font-medium tracking-tight max-w-[300px] mx-auto leading-relaxed">
                                                {t("auth.welcome.subtitle", "The most private way to communicate. Decentralized & anonymous.")}
                                            </p>
                                        </div>

                                        <div className="w-full grid grid-cols-1 gap-4 pt-4">
                                            <Button
                                                onClick={() => setMode("create")}
                                                className="h-16 rounded-[24px] bg-zinc-900 hover:bg-black dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black text-lg font-bold group shadow-xl shadow-zinc-500/10"
                                            >
                                                {t("auth.welcome.createIdentity", "Create New Identity")}
                                                <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
                                            </Button>
                                            <Button
                                                variant="outline"
                                                onClick={() => {
                                                    setLoginTab("key");
                                                    setMode("login");
                                                }}
                                                className="h-16 rounded-[24px] border-black/10 dark:border-white/10 bg-white/50 hover:bg-black/5 dark:bg-zinc-900/50 dark:hover:bg-white/5 text-lg font-bold transition-all"
                                            >
                                                {t("auth.welcome.loginWithKey", "Log In with Key")}
                                            </Button>
                                            <Button
                                                variant="outline"
                                                onClick={() => setMode("restore")}
                                                className="h-14 rounded-[24px] border-black/10 dark:border-white/10 bg-white/50 hover:bg-black/5 dark:bg-zinc-900/50 dark:hover:bg-white/5 text-base font-bold"
                                            >
                                                <ArchiveRestore className="h-4 w-4" />
                                                {t("auth.welcome.restoreBackup", "Restore from backup")}
                                            </Button>
                                            <div className="flex items-center justify-center gap-2 pt-4">
                                                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                                <p className="text-[10px] text-zinc-400 uppercase tracking-[0.2em] font-black">
                                                    {t("auth.welcome.encryptedIdentity", "End-to-End Encrypted Identity")}
                                                </p>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </motion.div>
                        )}

                        {mode === "create" && (
                            <motion.div
                                key={`create-step-${step}`}
                                initial="enter"
                                animate="center"
                                exit="exit"
                                variants={variants}
                                custom={step}
                                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                className="w-full space-y-8"
                            >
                                <div className="text-center space-y-3">
                                    <h2 className="text-3xl font-black tracking-tighter text-zinc-900 dark:text-white">
                                        {step === 1
                                            ? t("auth.create.pickNameTitle", "Pick a Name")
                                            : t("auth.create.secureItTitle", "Secure It")}
                                    </h2>
                                    <p className="text-zinc-500 dark:text-zinc-400 font-medium">
                                        {step === 1
                                            ? t("auth.create.pickNameDesc", "This will be your visible profile name.")
                                            : t("auth.create.secureItDesc", "Set a password to protect your keys.")}
                                    </p>
                                </div>

                                {step === 1 ? (
                                    <div className="space-y-6">
                                        <div className="space-y-3">
                                            <Label className="pl-1 text-[11px] font-black uppercase tracking-widest text-zinc-500">{t("auth.usernameLabel", "Username")}</Label>
                                            <div className="relative group">
                                                <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400 group-focus-within:text-purple-500 transition-colors" />
                                                <Input
                                                    autoFocus
                                                    placeholder={t("auth.usernamePlaceholder", "e.g. Satoshi")}
                                                    value={username}
                                                    onChange={e => setUsername(e.target.value)}
                                                    className="pl-12 h-16 rounded-[24px] bg-white/50 dark:bg-zinc-900/50 border-black/5 dark:border-white/5 focus:ring-4 focus:ring-purple-500/10 text-lg transition-all"
                                                />
                                            </div>
                                        </div>
                                        <Button
                                            disabled={username.length < 2}
                                            onClick={() => setStep(2)}
                                            className="w-full h-16 rounded-[24px] bg-purple-600 hover:bg-purple-700 text-white text-lg font-bold shadow-xl shadow-purple-500/20"
                                        >
                                            {t("common.continue", "Continue")}
                                            <ArrowRight className="h-5 w-5 ml-2" />
                                        </Button>
                                    </div>
                                ) : (
                                    <form onSubmit={handleCreateFinal} className="space-y-6">
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between mb-1">
                                                    <Label className="pl-1 text-[11px] font-black uppercase tracking-widest text-zinc-500">{t("auth.masterPasswordLabel", "Master Password")}</Label>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const gen = generateSecurePassword();
                                                            setPassword(gen);
                                                            setConfirmPassword(gen);
                                                            toast.success(t("auth.passwordGenerated", "Password generated. Please save it securely."));
                                                        }}
                                                        className="text-[11px] font-black uppercase tracking-widest text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 transition-colors"
                                                    >
                                                        {t("auth.generatePassword", "Generate Code")}
                                                    </button>
                                                </div>
                                                <div className="relative group">
                                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400 group-focus-within:text-purple-500 transition-colors" />
                                                    <Input
                                                        type={showPassword ? "text" : "password"}
                                                        placeholder={t("auth.createPasswordPlaceholder", "Create a strong password")}
                                                        value={password}
                                                        onChange={e => setPassword(e.target.value)}
                                                        className="px-12 h-16 rounded-[24px] bg-white/50 dark:bg-zinc-900/50 border-black/5 dark:border-white/5 focus:ring-4 focus:ring-purple-500/10 text-lg transition-all"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowPassword(!showPassword)}
                                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                                                    >
                                                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                                    </button>
                                                </div>
                                                <PasswordStrengthIndicator password={password} />
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="pl-1 text-[11px] font-black uppercase tracking-widest text-zinc-500">{t("auth.confirmPasswordLabel", "Confirm")}</Label>
                                                <div className="relative group">
                                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400 group-focus-within:text-purple-500 transition-colors" />
                                                    <Input
                                                        type={showPassword ? "text" : "password"}
                                                        placeholder={t("auth.confirmPasswordPlaceholder", "Repeat your password")}
                                                        value={confirmPassword}
                                                        onChange={e => setConfirmPassword(e.target.value)}
                                                        className="px-12 h-16 rounded-[24px] bg-white/50 dark:bg-zinc-900/50 border-black/5 dark:border-white/5 focus:ring-4 focus:ring-purple-500/10 text-lg transition-all"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <AuthSessionPolicyNotice />

                                        <div className="p-4 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex gap-4">
                                            <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                                            <div className="space-y-3">
                                                <p className="text-xs text-amber-600 dark:text-amber-400 font-bold leading-relaxed">
                                                    {t("auth.passwordRecoveryWarning", "There is no password recovery. If you lose this password and device, your account may be unrecoverable. You can log in from any device using your private key, so never lose it.")}
                                                </p>
                                                <p className="text-xs text-amber-700 dark:text-amber-300 font-semibold leading-relaxed">
                                                    {keyOwnershipReminder} {keyRecoveryReminder}
                                                </p>
                                                <div className="flex items-start space-x-4 pt-1">
                                                    <Checkbox
                                                        id="acknowledge-create"
                                                        checked={acknowledged}
                                                        onCheckedChange={(checked) => setAcknowledged(checked as boolean)}
                                                        className="h-4 w-4 rounded border-amber-500/50 data-[state=checked]:bg-amber-500 -ml-1"
                                                    />
                                                    <label htmlFor="acknowledge-create" className="text-[10px] font-black uppercase tracking-wider text-amber-600/80 dark:text-amber-400/80 cursor-pointer leading-tight">
                                                        {t("auth.acknowledgeKeyResponsibility", "I understand I am responsible for my keys")}
                                                    </label>
                                                </div>
                                            </div>
                                        </div>

                                        <FlashMessage
                                            message={authError}
                                            onClose={() => setAuthError(null)}
                                            className="mt-4"
                                        />

                                        <Button
                                            type="submit"
                                            disabled={isLoading || password !== confirmPassword || password.length < 8 || !acknowledged}
                                            className="w-full h-16 rounded-[24px] bg-purple-600 hover:bg-purple-700 text-white text-lg font-bold shadow-xl shadow-purple-500/20 disabled:opacity-50 relative overflow-hidden group"
                                        >
                                            {isLoading ? (
                                                <div className="flex items-center gap-2">
                                                    <motion.div
                                                        animate={{ rotate: 360 }}
                                                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                                    >
                                                        <Sparkles className="h-5 w-5" />
                                                    </motion.div>
                                                    <span>{t("auth.generating", "Generating...")}</span>
                                                    
                                                </div>
                                            ) : (
                                                t("auth.generateSafeIdentity", "Generate Safe Identity")
                                            )}

                                            {isLoading && (
                                                <motion.div
                                                    initial={{ x: "-100%" }}
                                                    animate={{ x: "100%" }}
                                                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                                                />
                                            )}
                                        </Button>

                                    </form>
                                )}
                            </motion.div>
                        )}

                        {mode === "login" && (
                            <motion.div
                                key={`login-step-${step}`}
                                initial="enter"
                                animate="center"
                                exit="exit"
                                variants={variants}
                                custom={step}
                                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                className="w-full space-y-8"
                            >
                                <div className="text-center space-y-3">
                                    <h2 className="text-3xl font-black tracking-tighter text-zinc-900 dark:text-white">
                                        {t("auth.login.welcomeBackTitle", "Welcome Back")}
                                    </h2>
                                    <p className="text-zinc-500 dark:text-zinc-400 font-medium text-balance">
                                        {hasStoredIdentity
                                            ? (storedUsernameHint
                                                ? t("auth.login.welcomeBackUnlockNamed", "Enter your password to unlock {{username}} on this device.", { username: storedUsernameHint })
                                                : t("auth.login.welcomeBackUnlock", "Enter your password to unlock this profile on this device."))
                                            : hasLocalAccountEvidence
                                                ? t("auth.login.welcomeBackLocalEvidence", "This profile window already has local account data. Unlock with your password or import key.")
                                                : t("auth.login.welcomeBackDesc", "Enter your credentials to unlock. Obscur does not keep you signed in on this device.")}
                                    </p>
                                </div>

                                <div className="space-y-6">
                                        <div className="flex bg-black/5 dark:bg-white/5 rounded-2xl p-1 relative z-10">
                                            <button
                                                type="button"
                                                onClick={() => setLoginTab("username")}
                                                disabled={!hasStoredIdentity}
                                                className={cn(
                                                    "flex-1 py-3 text-sm font-bold rounded-xl transition-all",
                                                    loginTab === "username"
                                                        ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow shadow-black/5"
                                                        : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300",
                                                    !hasStoredIdentity ? "cursor-not-allowed opacity-50 hover:text-zinc-500 dark:hover:text-zinc-500" : "",
                                                )}
                                            >
                                                {t("auth.login.tabPassword", "Log In")}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setLoginTab("key")}
                                                className={cn("flex-1 py-3 text-sm font-bold rounded-xl transition-all", loginTab === "key" ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow shadow-black/5" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300")}
                                            >
                                                {t("auth.login.tabImportKey", "Import Key")}
                                            </button>
                                        </div>

                                        {!hasLocalAccountEvidence ? (
                                            <p className="px-2 text-xs text-zinc-500 dark:text-zinc-400">
                                                {t("auth.login.deviceLocalHint", "Username/password unlock is device-local. Import your private key once on this device to enable it.")}
                                            </p>
                                        ) : null}

                                        {!hasLocalAccountEvidence ? (
                                            <button
                                                type="button"
                                                onClick={() => setMode("restore")}
                                                className="text-xs font-semibold text-violet-600 underline underline-offset-2 dark:text-violet-300"
                                            >
                                                {t("auth.login.openRestorePage", "Restore from unified backup")}
                                            </button>
                                        ) : null}

                                        {loginTab === "key" ? (
                                            <>
                                                <div className="space-y-3 mt-4">
                                                    <Label className="pl-1 text-[11px] font-black uppercase tracking-widest text-zinc-500">{t("identity.privateKey", "Private Key")}</Label>
                                                    <p className="px-1 text-xs text-zinc-500 dark:text-zinc-400">
                                                        {hasLocalAccountEvidence
                                                            ? t("auth.import.privateKeyReturningHelp", "Use this only when switching to a different account in this profile window.")
                                                            : t("auth.import.privateKeyHelp", "Import Key restores an existing account only. If this key has no local or relay-backed account evidence, use Create Account instead.")}
                                                    </p>
                                                    <div className="relative group">
                                                        <Key className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400 group-focus-within:text-blue-500 transition-colors" />
                                                        <input
                                                            autoFocus
                                                            type="password"
                                                            placeholder="nsec1..."
                                                            value={privateKey}
                                                            onChange={e => {
                                                                setPrivateKey(e.target.value);
                                                                setRetiredKeyReuseAcknowledged(false);
                                                            }}
                                                            className="flex h-16 w-full rounded-[24px] border border-black/5 bg-white/50 px-12 py-2 text-lg ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/10 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/5 dark:bg-zinc-900/50 transition-all"
                                                        />
                                                    </div>
                                                </div>
                                                <AuthSessionPolicyNotice />
                                                {isRetiredImportKey ? (
                                                    <div className="rounded-3xl border border-amber-500/25 bg-amber-500/10 p-4">
                                                        <div className="flex gap-3">
                                                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                                                            <div className="space-y-3">
                                                                <p className="text-xs font-semibold leading-relaxed text-amber-700 dark:text-amber-300">
                                                                        {t("auth.import.retiredKeyWarning", "This key was previously marked as retired on this device. Reactivating it can restore prior identity links from relays.")}
                                                                    </p>
                                                                <div className="flex items-start space-x-3">
                                                                    <Checkbox
                                                                        id="acknowledge-retired-import"
                                                                        checked={retiredKeyReuseAcknowledged}
                                                                        onCheckedChange={(checked) => setRetiredKeyReuseAcknowledged(Boolean(checked))}
                                                                        className="mt-0.5 h-4 w-4 rounded border-amber-500/50 data-[state=checked]:bg-amber-500"
                                                                    />
                                                                    <label htmlFor="acknowledge-retired-import" className="cursor-pointer text-[11px] font-black uppercase tracking-wider text-amber-700/90 dark:text-amber-300/90">
                                                                        {t("auth.import.retiredKeyAcknowledge", "I understand and want to reactivate this identity on this device")}
                                                                    </label>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : null}
                                                <Button
                                                    disabled={isLoading || privateKey.length < 10 || (isRetiredImportKey && !retiredKeyReuseAcknowledged)}
                                                    onClick={() => {
                                                        void handleContinueImportKey();
                                                    }}
                                                    className="w-full h-16 rounded-[24px] bg-blue-600 hover:bg-blue-700 text-white text-lg font-bold shadow-xl shadow-blue-500/20"
                                                >
                                                    {isLoading ? (
                                                        <motion.div
                                                            animate={{ rotate: 360 }}
                                                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                                        >
                                                            <Sparkles className="h-5 w-5" />
                                                        </motion.div>
                                                    ) : (
                                                        <>
                                                            {t("common.continue", "Continue")}
                                                            <ArrowRight className="h-5 w-5 ml-2" />
                                                        </>
                                                    )}
                                                </Button>
                                                <FlashMessage
                                                    message={authError}
                                                    onClose={() => setAuthError(null)}
                                                    className="mt-4"
                                                />
                                            </>
                                        ) : (
                                            <>
                                                <form onSubmit={handleLoginUsername} className="space-y-6">
                                                    <div className="space-y-5">
                                                        <div className="space-y-2">
                                                            <Label className="pl-1 text-[11px] font-black uppercase tracking-widest text-zinc-500">{t("auth.usernameLabel", "Username")}</Label>
                                                            <div className="relative group">
                                                                <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400 group-focus-within:text-blue-500 transition-colors" />
                                                                <Input
                                                                    autoFocus
                                                                    placeholder={t("auth.usernamePlaceholder", "e.g. Satoshi")}
                                                                    value={username}
                                                                    onChange={e => setUsername(e.target.value)}
                                                                    className="px-12 h-16 rounded-[24px] bg-white/50 dark:bg-zinc-900/50 border-black/5 dark:border-white/5 focus:ring-4 focus:ring-blue-500/10 text-lg transition-all"
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label className="pl-1 text-[11px] font-black uppercase tracking-widest text-zinc-500">{t("auth.masterPasswordLabel", "Master Password")}</Label>
                                                            <div className="relative group">
                                                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400 group-focus-within:text-blue-500 transition-colors" />
                                                                <Input
                                                                    type={showPassword ? "text" : "password"}
                                                                    placeholder={t("auth.enterPasswordPlaceholder", "Enter your password")}
                                                                    value={password}
                                                                    onChange={e => setPassword(e.target.value)}
                                                                    className="px-12 h-16 rounded-[24px] bg-white/50 dark:bg-zinc-900/50 border-black/5 dark:border-white/5 focus:ring-4 focus:ring-blue-500/10 text-lg transition-all"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setShowPassword(!showPassword)}
                                                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                                                                >
                                                                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <AuthSessionPolicyNotice />

                                                    <FlashMessage
                                                        message={authError}
                                                        onClose={() => setAuthError(null)}
                                                        className="mt-4"
                                                    />

                                                    <Button
                                                        type="submit"
                                                        disabled={isLoading}
                                                        className="w-full h-16 rounded-[24px] bg-blue-600 hover:bg-blue-700 text-white text-lg font-bold shadow-xl shadow-blue-500/20"
                                                    >
                                                        {isLoading ? (
                                                            <motion.div
                                                                animate={{ rotate: 360 }}
                                                                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                                            >
                                                                <Sparkles className="h-5 w-5" />
                                                            </motion.div>
                                                        ) : (
                                                            t("auth.login.submit", "Log In")
                                                        )}
                                                    </Button>
                                                </form>
                                            </>
                                        )}
                                </div>
                            </motion.div>
                        )}

                        {mode === "restore" && (
                            <motion.div
                                key="restore"
                                initial="enter"
                                animate="center"
                                exit="exit"
                                variants={variants}
                                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                className="w-full"
                            >
                                <AuthScreenRestorePage
                                    onNavigateToLogin={() => {
                                        setLoginTab("key");
                                        setMode("login");
                                    }}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {activeSessionConflict ? (
                        <AccountActiveInOtherProfileInline
                            incomingPublicKeyHex={activeSessionConflict.incomingPublicKeyHex}
                            activeProfileLabel={activeSessionConflict.activeProfileLabel}
                            onClose={() => {
                                setActiveSessionConflict(null);
                                setPendingAuthAction(null);
                                setAuthError(null);
                            }}
                        />
                    ) : null}

                    {accountConflict && pendingAuthAction ? (
                        <ProfileSlotAccountConflictInline
                            profileLabel={boundProfileLabel}
                            occupantPublicKeyHex={accountConflict.occupantPublicKeyHex}
                            incomingPublicKeyHex={
                                pendingAuthAction.kind === "import_key"
                                    ? derivePublicKeyHex(pendingAuthAction.privateKeyHex)
                                    : accountConflict.occupantPublicKeyHex
                            }
                            intent={pendingAuthAction.kind === "create" ? "create_account" : "import_account"}
                            isBusy={isConflictBusy || isLoading}
                            canOpenAnotherWindow={hasNativeRuntime()}
                            onOpenAnotherWindow={() => { void handleOpenAnotherProfileWindow(); }}
                            onClearWindow={() => { void clearWindowAndRetryLogin(false); }}
                            onExportAndClear={() => { void clearWindowAndRetryLogin(true); }}
                            onClose={() => {
                                setAccountConflict(null);
                                setPendingAuthAction(null);
                            }}
                        />
                    ) : null}

                    {lastArchiveResult !== null ? (
                        <ProfileArchiveResultInline
                            result={lastArchiveResult}
                            profileLabel={boundProfileLabel}
                            onClose={() => setLastArchiveResult(null)}
                        />
                    ) : null}
                </div>

                <div className="px-12 py-8 bg-black/5 dark:bg-white/5 border-t border-black/[0.03] dark:border-white/[0.03] flex items-center justify-center gap-6">
                    <div className="flex items-center gap-2 opacity-40 hover:opacity-100 transition-opacity cursor-help group/tip">
                        <Shield className="h-4 w-4 text-emerald-500" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t("auth.footer.selfCustody", "Self-Custody")}</span>
                        
                    </div>
                    <div className="h-4 w-px bg-zinc-300 dark:bg-zinc-700" />
                    <div className="flex items-center gap-2 opacity-40 hover:opacity-100 transition-opacity cursor-help group/tip">
                        <UserCheck className="h-4 w-4 text-purple-500" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t("auth.footer.anonymous", "Anonymous")}</span>
                    </div>
                </div>
            </Card>

        </div>
    );
}
