"use client";
import React, { useState, useCallback, useRef } from "react";
import Image from "next/image";
import { UserPlus, LogIn, ArrowRight, Shield, User, Lock, Eye, EyeOff, ChevronLeft, CheckCircle2, Sparkles, Key, UserCheck, ArchiveRestore, AlertCircle, } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@dweb/ui-kit";
import { Input } from "@dweb/ui-kit";
import { Card } from "@dweb/ui-kit";
import { Label } from "@dweb/ui-kit";
import { cn } from "@/app/lib/utils";
import { useIdentity, useIdentityInternals, getIdentitySnapshot } from "../hooks/use-identity";
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
import { isDesktopOsSessionRestoreAvailable } from "../services/session-credential-policy";
import { readDeviceSessionConsent } from "../services/device-session-consent";
import { AuthSessionPolicyNotice } from "./auth-session-policy-notice";
import { DesktopAtRestEncryptionNotice } from "@/app/features/settings/components/desktop-at-rest-encryption-notice";
import { AuthLoginHelpNote } from "./auth-login-help-note";
import { SecurityLiteracyNote } from "@/app/features/security/components/security-literacy-note";
import {
  IdentityPassphrasePolicyError,
  isIdentityPassphrasePolicyCompliant,
} from "@/app/features/security/services/identity-passphrase-policy";
import { UnlockRateLimitError } from "@/app/features/auth/services/unlock-attempt-rate-limit";
import { useWindowRuntime } from "@/app/features/runtime/services/window-runtime-supervisor";
import { shouldEnterLoginModeOnStartup, startupAuthStateHasPrivateKeyMismatch, startupAuthStateHasStoredIdentity, } from "@/app/features/auth/services/startup-auth-state-contracts";
import { generateRandomInviteCode } from "@/app/features/invites/utils/invite-code-format";
import { logAppEvent } from "@/app/shared/log-app-event";
import { isRetiredIdentityPublicKey } from "../utils/retired-identity-registry";
import { AuthScreenRestorePage } from "@/app/features/profiles/components/auth-screen-restore-page";
import { AccountActiveInOtherProfileInline } from "@/app/features/profiles/components/account-active-in-other-profile-inline";
import { ProfileSlotAccountConflictInline } from "@/app/features/profiles/components/profile-slot-account-conflict-inline";
import { AccountActiveInOtherProfileWindowError, } from "@/app/features/profiles/services/cross-profile-active-session-lease";
import { AUTH_CLIENT_REVISION, profileWindowHasLocalAccountEvidence, } from "@/app/features/auth/services/auth-profile-local-evidence";
import { clearProfileSlotForDifferentAccount, openFreshProfileWindowForSignIn, } from "@/app/features/profiles/services/profile-slot-account-switch";
import { ProfileSlotAccountConflictError, type ProfileSlotLoginAttemptResult, } from "@/app/features/profiles/services/profile-slot-login-guard";
import {
  greenfieldAuthWindowLabel,
  requiresFreshProfileWindowForGreenfieldAuth,
  type GreenfieldAuthIntent,
} from "@/app/features/profiles/services/profile-slot-greenfield-auth-routing";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { ProfileArchiveResultInline } from "@/app/features/profiles/components/profile-archive-result-inline";
import { hasPasswordProtectedUnlockOnDevice } from "@/app/features/profiles/services/identity-passphrase-unlock";
import { isPasswordlessNativeOnlyIdentity } from "@/app/features/auth/services/passwordless-native-only-identity";
import { useAuthKernelSurfaceActions } from "@/app/features/auth-kernel/hooks/use-auth-kernel-surface-actions";
import { AuthAssistantPanel } from "@/app/features/auth-kernel/components/auth-assistant-panel";
import { AuthAssistantSavePrompt } from "@/app/features/auth-kernel/components/auth-assistant-save-prompt";
import type { AuthAssistantEntry } from "@dweb/auth";
const authPrimaryButtonClass = "w-full h-12 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white text-base font-bold shadow-lg shadow-purple-500/20";
const resolveAuthSecurityErrorMessage = (error: unknown, t: (key: string, options?: Record<string, unknown>) => string): string | null => {
    if (error instanceof UnlockRateLimitError) {
        const seconds = Math.max(1, Math.ceil(error.retryAfterMs / 1000));
        return t("security.unlock.rateLimited", { seconds });
    }
    if (error instanceof IdentityPassphrasePolicyError) {
        return t(`security.passphrase.policy.${error.reason}`);
    }
    return null;
};
const authCompactInputClass = "px-11 h-12 rounded-2xl bg-white/50 dark:bg-zinc-900/50 border-black/5 dark:border-white/5 text-base transition-all";
const authSecondaryPrimaryButtonClass = "h-16 w-full rounded-[24px] bg-purple-600 hover:bg-purple-700 text-white text-lg font-bold shadow-xl shadow-purple-500/20";
const authInputFocusRingClass = "focus:ring-4 focus:ring-purple-500/10";
const authIconFocusClass = "group-focus-within:text-purple-500 transition-colors";
type PendingAuthAction = Readonly<{
    kind: "import_key";
    privateKeyHex: PrivateKeyHex;
    passphrase: Passphrase;
    username?: string;
} | {
    kind: "create";
    passphrase: Passphrase;
    username: string;
}>;
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
type ImportKeyGuideStep = "enter_key" | "set_device_password";
const NO_DEVICE_PASSWORD_UNLOCK_HINT = "No device password unlock is saved for this profile on this device";
export function AuthScreen() {
    const { t } = useTranslation();
    const identity = useIdentity();
    const runtime = useWindowRuntime();
    const startupState = runtime.snapshot.session.startupState;
    const profile = useProfile();
    const boundProfileId = runtime.snapshot.session.profileId;
    const boundProfileLabel = runtime.snapshot.session.profileLabel ?? boundProfileId;
    const hasNativeMismatch = startupState.mismatchReason === "native_mismatch";
    const hasStoredIdentity = startupAuthStateHasStoredIdentity(startupState)
        || Boolean(identity.state.stored?.publicKeyHex);
    const hasLocalAccountEvidence = hasStoredIdentity
        || profileWindowHasLocalAccountEvidence(boundProfileId);
    const authSurfaceReady = startupState.kind !== "pending" && identity.state.status !== "loading";
    const isPasswordlessNativeOnly = isPasswordlessNativeOnlyIdentity(identity.state.stored);
    const passwordLoginAvailable = hasStoredIdentity || hasLocalAccountEvidence;
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
    const [accountConflict, setAccountConflict] = useState<Extract<ProfileSlotLoginAttemptResult, {
        status: "blocked_different_account";
    }> | null>(null);
    const [activeSessionConflict, setActiveSessionConflict] = useState<AccountActiveInOtherProfileWindowError["detail"] | null>(null);
    const [pendingAuthAction, setPendingAuthAction] = useState<PendingAuthAction | null>(null);
    const [isConflictBusy, setIsConflictBusy] = useState(false);
    const [lastArchiveResult, setLastArchiveResult] = useState<{
        fileName: string;
        absolutePath: string | null;
        downloadTriggered: boolean;
    } | null>(null);
    const [devicePasswordUnlockSaved, setDevicePasswordUnlockSaved] = useState<boolean | null>(null);
    const [importKeyGuideStep, setImportKeyGuideStep] = useState<ImportKeyGuideStep>("enter_key");
    const authKernel = useAuthKernelSurfaceActions();
    const [assistantEntry, setAssistantEntry] = useState<AuthAssistantEntry | null>(null);
    const [assistantBusy, setAssistantBusy] = useState(false);
    const [showAssistantSavePrompt, setShowAssistantSavePrompt] = useState(false);
    const pendingAssistantSavePasswordRef = useRef<string | null>(null);
    const needsDevicePasswordSetupGuide = (isPasswordlessNativeOnly
        && hasStoredIdentity
        && devicePasswordUnlockSaved === false);
    const keyOwnershipReminder = t("auth.keyOwnershipReminder");
    const keyRecoveryReminder = t("auth.keyRecoveryReminder");
    // Form states
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [privateKey, setPrivateKey] = useState("");
    const sessionUnlockOptions = React.useMemo(() => ({
        staySignedIn: isDesktopOsSessionRestoreAvailable()
            ? true
            : readDeviceSessionConsent(boundProfileId),
    }) as const, [boundProfileId]);
    const decodedImportPrivateKey = React.useMemo(() => decodePrivateKey(privateKey), [privateKey]);
    const importCandidatePublicKeyHex = React.useMemo(() => {
        if (!decodedImportPrivateKey) {
            return null;
        }
        try {
            return derivePublicKeyHex(decodedImportPrivateKey as PrivateKeyHex);
        }
        catch {
            return null;
        }
    }, [decodedImportPrivateKey]);
    const isRetiredImportKey = importCandidatePublicKeyHex
        ? isRetiredIdentityPublicKey(importCandidatePublicKeyHex)
        : false;
    const hasAppliedInitialEntryRouteRef = useRef(false);
    const storedUsernameHint = identity.state.stored?.username?.trim();
    const previousIdentityStatusRef = useRef(identity.state.status);
    React.useEffect(() => {
        if (identity.state.status !== "locked" || !isPasswordlessNativeOnlyIdentity(identity.state.stored)) {
            return;
        }
        void useIdentityInternals.rehydrateIdentityForActiveProfile();
    }, [boundProfileId, identity.state.status, identity.state.stored?.publicKeyHex]);
    React.useEffect(() => {
        const storedPubkey = identity.state.stored?.publicKeyHex;
        if (!isPasswordlessNativeOnly || !storedPubkey) {
            setDevicePasswordUnlockSaved(null);
            setImportKeyGuideStep("enter_key");
            return;
        }
        let cancelled = false;
        void hasPasswordProtectedUnlockOnDevice({
            profileId: boundProfileId,
            publicKeyHex: storedPubkey,
        }).then((saved) => {
            if (cancelled) {
                return;
            }
            setDevicePasswordUnlockSaved(saved);
            if (!saved) {
                setLoginTab("key");
                setImportKeyGuideStep("enter_key");
            }
        });
        return () => {
            cancelled = true;
        };
    }, [
        boundProfileId,
        identity.state.stored?.publicKeyHex,
        isPasswordlessNativeOnly,
    ]);
    React.useEffect(() => {
        const previousStatus = previousIdentityStatusRef.current;
        previousIdentityStatusRef.current = identity.state.status;
        if (previousStatus === "unlocked" && identity.state.status === "locked") {
            setPassword("");
            setPrivateKey("");
            if (passwordLoginAvailable) {
                setLoginTab("username");
            }
        }
    }, [identity.state.status, passwordLoginAvailable]);
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
            if (hasStoredIdentity || hasLocalAccountEvidence) {
                setLoginTab("username");
            }
            else {
                setLoginTab("key");
            }
        }
    }, [hasLocalAccountEvidence, hasStoredIdentity, identity.state.status, identity.state.stored, startupState]);
    React.useEffect(() => {
        let cancelled = false;
        if (!hasNativeRuntime() || !boundProfileId || !hasStoredIdentity) {
            setAssistantEntry(null);
            return () => {
                cancelled = true;
            };
        }
        void authKernel.ports.authAssistant.readEntry(boundProfileId).then((result) => {
            if (cancelled || result.status !== "ok") {
                return;
            }
            setAssistantEntry(result.value ?? null);
        });
        return () => {
            cancelled = true;
        };
    }, [authKernel.ports, boundProfileId, hasStoredIdentity, identity.state.status]);
    const handleAssistantUnlock = async (): Promise<void> => {
        const stored = identity.state.stored;
        if (!stored?.publicKeyHex || identity.state.status === "unlocked" || getIdentitySnapshot().status === "unlocked") {
            return;
        }
        setAssistantBusy(true);
        setAuthError(null);
        try {
            const result = await authKernel.ports.authAssistant.unlockWithAssistantGesture({
                profileId: boundProfileId,
                expectedPublicKeyHex: stored.publicKeyHex,
            });
            if (result.status !== "ok") {
                const message = result.message ?? t("auth.assistant.unlockFailed");
                setAuthError(message);
                toast.error(message);
                return;
            }
            toast.success(t("auth.welcomeBackToast"));
        }
        catch (error) {
            const message = error instanceof Error ? error.message : t("auth.assistant.unlockFailed");
            setAuthError(message);
            toast.error(message);
        }
        finally {
            setAssistantBusy(false);
        }
    };
    const handleSaveAssistantUnlock = async (): Promise<void> => {
        const stored = identity.state.stored;
        const passphrase = pendingAssistantSavePasswordRef.current;
        if (!stored || !passphrase) {
            setShowAssistantSavePrompt(false);
            return;
        }
        setAssistantBusy(true);
        try {
            const result = await authKernel.ports.authAssistant.saveUnlockMaterial({
                profileId: boundProfileId,
                username: stored.username?.trim() || boundProfileLabel,
                passphrase: passphrase as Passphrase,
            });
            if (result.status !== "ok") {
                toast.error(result.message ?? t("auth.assistant.saveFailed"));
                return;
            }
            const entryResult = await authKernel.ports.authAssistant.readEntry(boundProfileId);
            if (entryResult.status === "ok") {
                setAssistantEntry(entryResult.value ?? null);
            }
            setShowAssistantSavePrompt(false);
            pendingAssistantSavePasswordRef.current = null;
        }
        finally {
            setAssistantBusy(false);
        }
    };
    const dismissAssistantSavePrompt = (): void => {
        setShowAssistantSavePrompt(false);
        pendingAssistantSavePasswordRef.current = null;
    };
    const handleBack = () => {
        if (step > 1) {
            setStep(step - 1);
        }
        else {
            setMode("welcome");
            resetForm();
        }
    };
    const handleResetNativeSecureStorage = useCallback(async () => {
        if (!identity.resetNativeSecureStorage) {
            setAuthError(t("auth.error.secureStorageResetUnavailable"));
            return;
        }
        setIsLoading(true);
        setAuthError(null);
        try {
            await identity.resetNativeSecureStorage();
            toast.success(t("auth.secureStorageResetSuccess"));
        }
        catch (error) {
            setAuthError(error instanceof Error ? error.message : t("auth.error.secureStorageResetFailed"));
        }
        finally {
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
        setImportKeyGuideStep("enter_key");
    };
    const guideToImportKeyForMissingDevicePassword = (): void => {
        const message = t("auth.login.noDevicePasswordGuide");
        setAuthError(message);
        setLoginTab("key");
        setImportKeyGuideStep("enter_key");
        toast.info(message);
    };
    const handleContinueImportKey = async (): Promise<void> => {
        setAuthError(null);
        const keyToUse = decodedImportPrivateKey;
        if (!keyToUse) {
            setAuthError(t("auth.error.invalidPrivateKeyFormat"));
            return;
        }
        if (isRetiredImportKey && !retiredKeyReuseAcknowledged) {
            setAuthError(t("auth.error.retiredKeyRequiresAcknowledgement"));
            return;
        }
        if (password.trim().length > 0 && !isIdentityPassphrasePolicyCompliant(password as Passphrase)) {
            setAuthError(t("security.passphrase.policy.too_short"));
            return;
        }
        if (needsDevicePasswordSetupGuide
            && importKeyGuideStep === "enter_key"
            && password.trim().length === 0
            && hasStoredIdentity) {
            const storedPubkey = identity.state.stored?.publicKeyHex;
            if (!storedPubkey || importCandidatePublicKeyHex !== storedPubkey) {
                setAuthError(t("auth.error.privateKeyMismatch"));
                return;
            }
            setImportKeyGuideStep("set_device_password");
            setPassword("");
            setConfirmPassword("");
            return;
        }
        if (importKeyGuideStep === "set_device_password") {
            if (!isIdentityPassphrasePolicyCompliant(password as Passphrase)) {
                setAuthError(t("security.passphrase.policy.too_short"));
                return;
            }
            if (password !== confirmPassword) {
                setAuthError(t("auth.error.passwordsDoNotMatch"));
                return;
            }
        }
        await handleLoginFinal(undefined, password.trim().length === 0);
    };
    const handleSkipDevicePasswordSetup = async (): Promise<void> => {
        setAuthError(null);
        setIsLoading(true);
        try {
            await handleLoginFinal(undefined, true);
        }
        finally {
            setIsLoading(false);
        }
    };
    const runCreateIdentity = async (action: Extract<PendingAuthAction, {
        kind: "create";
    }>): Promise<void> => {
        const gate = await authKernel.evaluateRegistrationGate(boundProfileId);
        if (gate.throttled) {
            const retryMinutes = Math.max(1, Math.ceil(gate.retryAfterMs / 60_000));
            throw new Error(t("auth.registrationThrottled", { minutes: retryMinutes }));
        }
        if (!gate.evaluation.allowed) {
            throw new Error("New accounts require an invite on this network. Import an existing key instead.");
        }
        if (gate.powDifficulty) {
            await authKernel.createPoWIdentityForBoundProfile({
                passphrase: action.passphrase,
                username: action.username,
                difficulty: gate.powDifficulty,
                ...sessionUnlockOptions,
            });
        }
        else {
            await authKernel.createIdentityForBoundProfile({
                passphrase: action.passphrase,
                username: action.username,
                ...sessionUnlockOptions,
            });
        }
        const inviteCode = generateRandomInviteCode();
        profile.setUsername({ username: action.username });
        profile.setInviteCode({ inviteCode });
        profile.save();
        toast.success(t("auth.identitySecured"));
    };
    const runImportKeyLogin = async (action: Extract<PendingAuthAction, {
        kind: "import_key";
    }>): Promise<void> => {
        await authKernel.importIdentityForBoundProfile({
            privateKeyHex: action.privateKeyHex,
            passphrase: action.passphrase,
            username: action.username,
            ...sessionUnlockOptions,
        });
        toast.info(t("auth.keyAcceptedRestoringData"));
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
    const needsFreshProfileWindowForGreenfieldAuth = requiresFreshProfileWindowForGreenfieldAuth(boundProfileId);
    const handleOpenFreshProfileWindowForGreenfieldAuth = async (intent: GreenfieldAuthIntent): Promise<void> => {
        setIsConflictBusy(true);
        try {
            await openFreshProfileWindowForSignIn(greenfieldAuthWindowLabel(intent));
            toast.success(intent === "create"
                ? t("auth.toast.openedNewWindowForCreate")
                : t("auth.toast.openedNewWindowForRestore"));
            setAccountConflict(null);
            setPendingAuthAction(null);
        }
        catch (error) {
            setAuthError(error instanceof Error ? error.message : "Could not open another profile window.");
        }
        finally {
            setIsConflictBusy(false);
        }
    };
    const handleGreenfieldAuthEntry = (intent: GreenfieldAuthIntent): void => {
        if (needsFreshProfileWindowForGreenfieldAuth) {
            void handleOpenFreshProfileWindowForGreenfieldAuth(intent);
            return;
        }
        resetForm();
        setMode(intent);
    };
    const handleOpenAnotherProfileWindow = (): void => {
        void handleOpenFreshProfileWindowForGreenfieldAuth("create");
    };
    React.useEffect(() => {
        if (mode !== "create" && mode !== "restore") {
            return;
        }
        if (!needsFreshProfileWindowForGreenfieldAuth) {
            return;
        }
        setMode("welcome");
        void handleOpenFreshProfileWindowForGreenfieldAuth(mode);
    }, [boundProfileId, mode, needsFreshProfileWindowForGreenfieldAuth]);
    const handleCreateFinal = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (needsFreshProfileWindowForGreenfieldAuth) {
            void handleOpenFreshProfileWindowForGreenfieldAuth("create");
            return;
        }
        if (!password || password !== confirmPassword) {
            setAuthError(t("auth.error.passwordsDoNotMatch"));
            return;
        }
        if (!isIdentityPassphrasePolicyCompliant(password as Passphrase)) {
            setAuthError(t("security.passphrase.policy.too_short"));
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
        }
        catch (error) {
            if (!handleAccountConflictError(error, pending)) {
                const securityMessage = resolveAuthSecurityErrorMessage(error, t);
                setAuthError(securityMessage ?? (error instanceof Error ? error.message : t("auth.error.createAccountFailed")));
            }
        }
        finally {
            setIsLoading(false);
        }
    };
    const resolveLoginPassword = (e?: React.FormEvent, passwordOverride?: string): string | null => {
        if (passwordOverride) {
            return passwordOverride;
        }
        let resolvedPassword = password;
        const form = e?.currentTarget;
        if (form instanceof HTMLFormElement) {
            const formData = new FormData(form);
            const formPassword = formData.get("password");
            if (typeof formPassword === "string" && formPassword && !resolvedPassword) {
                resolvedPassword = formPassword;
            }
        }
        if (!resolvedPassword.trim()) {
            return null;
        }
        return resolvedPassword;
    };
    const handleLoginUsername = async (e?: React.FormEvent, passwordOverride?: string) => {
        e?.preventDefault();
        if (isLoading || identity.state.status === "unlocked" || getIdentitySnapshot().status === "unlocked") {
            return;
        }
        const loginPassword = resolveLoginPassword(e, passwordOverride);
        if (!loginPassword) {
            if (getIdentitySnapshot().status === "unlocked") {
                return;
            }
            const message = t("auth.error.enterPassword");
            setAuthError(message);
            toast.error(message);
            return;
        }
        setIsLoading(true);
        setAuthError(null);
        try {
            const stored = identity.state.stored;
            if (!stored) {
                const message = t("auth.error.noLocalAccountYet");
                setAuthError(message);
                toast.error(message);
                setLoginTab("key");
                setIsLoading(false);
                return;
            }
            if (isPasswordlessNativeOnlyIdentity(stored)) {
                // Password unlock attempts repair from older encrypted snapshots before failing.
            }
            try {
                await authKernel.unlockBoundProfileWithPassphrase({
                    passphrase: loginPassword as Passphrase,
                    ...sessionUnlockOptions,
                });
            }
            catch (err) {
                if (err instanceof ProfileSlotAccountConflictError
                    || err instanceof AccountActiveInOtherProfileWindowError) {
                    throw err;
                }
                const securityMessage = resolveAuthSecurityErrorMessage(err, t);
                const message = securityMessage
                    ?? (err instanceof Error && err.message.trim()
                        ? err.message
                        : t("auth.error.incorrectPassword"));
                if (message.includes(NO_DEVICE_PASSWORD_UNLOCK_HINT)) {
                    guideToImportKeyForMissingDevicePassword();
                    setIsLoading(false);
                    return;
                }
                setAuthError(message);
                toast.error(message);
                setIsLoading(false);
                return;
            }
            toast.success(t("auth.welcomeBackToast"));
            if (hasNativeRuntime()) {
                const entryResult = await authKernel.ports.authAssistant.readEntry(boundProfileId);
                if (entryResult.status === "ok" && !entryResult.value?.hasSavedUnlock) {
                    pendingAssistantSavePasswordRef.current = loginPassword;
                    setShowAssistantSavePrompt(true);
                }
            }
            return;
        }
        catch (error) {
            const message = error instanceof Error
                ? error.message
                : t("auth.error.invalidPasswordOrAccount");
            if (message.includes(NO_DEVICE_PASSWORD_UNLOCK_HINT)) {
                guideToImportKeyForMissingDevicePassword();
            }
            else {
                setAuthError(message);
                toast.error(message);
            }
        }
        finally {
            setIsLoading(false);
        }
    };
    const handleLoginFinal = async (e?: React.FormEvent, skipPassword = false) => {
        e?.preventDefault();
        const providedPassword = skipPassword ? "" : password;
        const importPassphrase = providedPassword;
        if (!privateKey) {
            setAuthError(t("auth.error.privateKeyRequired"));
            return;
        }
        if (!skipPassword && !password) {
            setAuthError(t("auth.error.enterPasswordOrSkip"));
            return;
        }
        setIsLoading(true);
        let keyToUse: string | null = null;
        const resolvedImportUsername = username.trim()
            || identity.state.stored?.username?.trim()
            || profile.state.profile.username.trim()
            || undefined;
        try {
            keyToUse = decodePrivateKey(privateKey);
            if (!keyToUse) {
                setAuthError(t("auth.error.invalidKeyFormat"));
                setIsLoading(false);
                return;
            }
            const importPublicKeyHex = derivePublicKeyHex(keyToUse as PrivateKeyHex);
            if (isRetiredIdentityPublicKey(importPublicKeyHex) && !retiredKeyReuseAcknowledged) {
                setAuthError(t("auth.error.retiredKeyImportRequiresAcknowledgement"));
                setStep(1);
                setIsLoading(false);
                return;
            }
            const pending: PendingAuthAction = {
                kind: "import_key",
                privateKeyHex: keyToUse as PrivateKeyHex,
                passphrase: (importPassphrase || "") as Passphrase,
                username: resolvedImportUsername,
            };
            await runImportKeyLogin(pending);
        }
        catch (error) {
            if (keyToUse) {
                const pending: PendingAuthAction = {
                    kind: "import_key",
                    privateKeyHex: keyToUse as PrivateKeyHex,
                    passphrase: (importPassphrase || "") as Passphrase,
                    username: resolvedImportUsername,
                };
                if (handleAccountConflictError(error, pending)) {
                    return;
                }
            }
            setAuthError(error instanceof Error ? error.message : t("auth.error.importKeyFailed"));
        }
        finally {
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
        }
        catch (error) {
            setAuthError(error instanceof Error ? error.message : "Could not reset this profile window.");
        }
        finally {
            setIsConflictBusy(false);
            setIsLoading(false);
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
        return (<div className="relative flex flex-1 items-center justify-center p-4">
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                    Loading profile auth ({AUTH_CLIENT_REVISION})…
                </p>
            </div>);
    }
    return (<div className="relative flex-1 flex items-center justify-center p-4 overflow-y-auto z-[80]">
            <div className="absolute top-6 right-6 z-[160]">
                <LanguageSelector variant="minimal"/>
            </div>

            {/* Background elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <motion.div animate={{
            scale: [1, 1.1, 1],
            opacity: [0.1, 0.15, 0.1]
        }} transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }} className="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] bg-purple-500/10 rounded-full blur-[120px]"/>
                <motion.div animate={{
            scale: [1, 1.2, 1],
            opacity: [0.1, 0.12, 0.1]
        }} transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 2 }} className="absolute -bottom-[20%] -right-[10%] w-[70%] h-[70%] bg-blue-500/10 rounded-full blur-[120px]"/>
            </div>

            <Card className="w-full max-w-lg relative bg-white/40 dark:bg-zinc-900/40 backdrop-blur-3xl border-0 ring-1 ring-black/[0.05] dark:ring-white/[0.05] rounded-[32px] shadow-2xl overflow-hidden p-0">
                <div className="p-6 sm:p-8 min-h-0 flex flex-col justify-center">
                    {hasNativeMismatch && (<div className="mb-6 rounded-[28px] border border-amber-500/20 bg-amber-500/10 p-5">
                            <div className="flex items-start gap-4">
                                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500"/>
                                <div className="min-w-0 flex-1 space-y-3">
                                    <div>
                                        <p className="text-sm font-black uppercase tracking-[0.16em] text-amber-600 dark:text-amber-400">
                                            {t("auth.secureStorageRecoveryTitle")}
                                        </p>
                                        <p className="mt-2 text-sm font-medium leading-relaxed text-amber-700 dark:text-amber-200">
                                            {startupState.message ?? t("auth.secureStorageRecoveryDesc")}
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap gap-3">
                                        <Button type="button" variant="outline" onClick={handleResetNativeSecureStorage} disabled={isLoading} className="rounded-2xl border-amber-500/30 bg-white/70 text-amber-700 hover:bg-white dark:bg-zinc-950/30 dark:text-amber-300">
                                            {t("auth.resetSecureStorage")}
                                        </Button>
                                        <p className="self-center text-xs font-semibold text-amber-700/80 dark:text-amber-300/80">
                                            {t("auth.secureStorageRecoveryHint")}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>)}
                    {mode === "login" && hasPrivateKeyMismatch && (<div className="mb-6 rounded-[28px] border border-orange-500/20 bg-orange-500/10 p-5">
                            <div className="flex items-start gap-4">
                                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-orange-500"/>
                                <div className="min-w-0 flex-1 space-y-3">
                                    <div>
                                        <p className="text-sm font-black uppercase tracking-[0.16em] text-orange-600 dark:text-orange-400">
                                            {t("auth.privateKeyMismatchTitle")}
                                        </p>
                                        <p className="mt-2 text-sm font-medium leading-relaxed text-orange-700 dark:text-orange-200">
                                            {startupState.message ?? authError ?? t("auth.privateKeyMismatchDesc")}
                                        </p>
                                    </div>
                                    <p className="text-xs font-semibold text-orange-700/80 dark:text-orange-300/80">
                                        {t("auth.privateKeyMismatchHint")}
                                    </p>
                                </div>
                            </div>
                        </div>)}
                    <AnimatePresence mode="wait">
                        {mode !== "welcome" && (<motion.button key="back-button" type="button" aria-label={t("common.back")} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} onClick={handleBack} className="absolute top-8 left-8 z-20 p-3 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 group">
                                <ChevronLeft className="h-6 w-6 group-hover:-translate-x-0.5 transition-transform"/>
                            </motion.button>)}
                    </AnimatePresence>

                    <AnimatePresence mode="wait" custom={step}>
                        {mode === "welcome" && (<motion.div key={hasStoredIdentity ? "welcome-returning" : "welcome-new"} initial="enter" animate="center" exit="exit" variants={variants} transition={{ type: "spring", stiffness: 300, damping: 30 }} className="flex flex-col items-center text-center space-y-10">
                                <div className="relative group">
                                    <div className="absolute -inset-6 bg-gradient-to-tr from-purple-500 to-blue-500 rounded-[36px] blur-3xl opacity-20 group-hover:opacity-40 transition duration-1000"/>
                                    <div className="relative h-24 w-24 rounded-[32px] bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/5 flex items-center justify-center shadow-2xl overflow-hidden">
                                        <Image src="/obscur-logo-light.svg" alt="Obscur Logo" width={64} height={64} className="dark:hidden" priority/>
                                        <Image src="/obscur-logo-dark.svg" alt="Obscur Logo" width={64} height={64} className="hidden dark:block" priority/>
                                    </div>
                                </div>

                                {hasStoredIdentity ? (<>
                                        <div className="space-y-3">
                                            <h1 className="text-4xl font-black tracking-tighter text-zinc-900 dark:text-white">
                                                {t("auth.welcome.returning.title")}
                                            </h1>
                                            <p className="text-zinc-500 dark:text-zinc-400 text-base font-medium tracking-tight max-w-[320px] mx-auto leading-relaxed">
                                                {storedUsernameHint
                    ? t("auth.welcome.returning.subtitleNamed", { username: storedUsernameHint })
                    : t("auth.welcome.returning.subtitle")}
                                            </p>
                                        </div>

                                        <div className="w-full max-w-md space-y-4 pt-2 text-left">
                                            <AuthSessionPolicyNotice variant="card"/>
                                            {hasNativeRuntime() ? <DesktopAtRestEncryptionNotice variant="lock"/> : null}
                                            <Button onClick={() => {
                    setLoginTab("username");
                    setMode("login");
                }} className={authSecondaryPrimaryButtonClass}>
                                                {t("auth.welcome.returning.unlock")}
                                                <ArrowRight className="h-5 w-5 ml-2"/>
                                            </Button>
                                            <Button variant="outline" onClick={() => {
                    setLoginTab("key");
                    setMode("login");
                }} className="h-14 w-full rounded-[24px] border-black/10 dark:border-white/10 bg-white/50 hover:bg-black/5 dark:bg-zinc-900/50 dark:hover:bg-white/5 text-base font-bold">
                                                {t("auth.welcome.returning.useKey")}
                                            </Button>
                                            <button type="button" onClick={() => handleGreenfieldAuthEntry("create")} className="w-full pt-2 text-xs font-semibold text-zinc-500 underline-offset-4 hover:text-zinc-700 hover:underline dark:text-zinc-400 dark:hover:text-zinc-200">
                                                {needsFreshProfileWindowForGreenfieldAuth
                    ? t("auth.welcome.returning.openWindowToCreate")
                    : t("auth.welcome.returning.createAnother")}
                                            </button>
                                            <Button variant="outline" onClick={() => handleGreenfieldAuthEntry("restore")} className="h-12 w-full rounded-[24px] border-black/10 dark:border-white/10 bg-white/50 hover:bg-black/5 dark:bg-zinc-900/50 dark:hover:bg-white/5 text-sm font-bold">
                                                <ArchiveRestore className="h-4 w-4"/>
                                                {needsFreshProfileWindowForGreenfieldAuth
                    ? t("auth.welcome.returning.openWindowToRestore")
                    : t("auth.welcome.restoreBackup")}
                                            </Button>
                                        </div>
                                    </>) : (<>
                                        <div className="space-y-4">
                                            <h1 className="text-5xl font-black bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-500 dark:from-white dark:via-zinc-200 dark:to-zinc-500 bg-clip-text text-transparent tracking-tighter leading-tight">
                                                Obscur
                                            </h1>
                                            <p className="text-zinc-500 dark:text-zinc-400 text-lg font-medium tracking-tight max-w-[300px] mx-auto leading-relaxed">
                                                {t("auth.welcome.subtitle")}
                                            </p>
                                        </div>

                                        <div className="w-full grid grid-cols-1 gap-4 pt-4">
                                            <Button onClick={() => handleGreenfieldAuthEntry("create")} className="h-16 rounded-[24px] bg-zinc-900 hover:bg-black dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black text-lg font-bold group shadow-xl shadow-zinc-500/10">
                                                {t("auth.welcome.createIdentity")}
                                                <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform"/>
                                            </Button>
                                            <Button variant="outline" onClick={() => {
                    setLoginTab("key");
                    setMode("login");
                }} className="h-16 rounded-[24px] border-black/10 dark:border-white/10 bg-white/50 hover:bg-black/5 dark:bg-zinc-900/50 dark:hover:bg-white/5 text-lg font-bold transition-all">
                                                {t("auth.welcome.loginWithKey")}
                                            </Button>
                                            <Button variant="outline" onClick={() => handleGreenfieldAuthEntry("restore")} className="h-14 rounded-[24px] border-black/10 dark:border-white/10 bg-white/50 hover:bg-black/5 dark:bg-zinc-900/50 dark:hover:bg-white/5 text-base font-bold">
                                                <ArchiveRestore className="h-4 w-4"/>
                                                {t("auth.welcome.restoreBackup")}
                                            </Button>
                                            <div className="flex items-center justify-center gap-2 pt-4">
                                                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500"/>
                                                <p className="text-[10px] text-zinc-400 uppercase tracking-[0.2em] font-black">
                                                    {t("auth.welcome.encryptedIdentity")}
                                                </p>
                                            </div>
                                        </div>
                                    </>)}
                            </motion.div>)}

                        {mode === "create" && (<motion.div key={`create-step-${step}`} initial="enter" animate="center" exit="exit" variants={variants} custom={step} transition={{ type: "spring", stiffness: 300, damping: 30 }} className="w-full space-y-8">
                                <div className="text-center space-y-3">
                                    <h2 className="text-3xl font-black tracking-tighter text-zinc-900 dark:text-white">
                                        {step === 1
                ? t("auth.create.pickNameTitle")
                : t("auth.create.secureItTitle")}
                                    </h2>
                                    <p className="text-zinc-500 dark:text-zinc-400 font-medium">
                                        {step === 1
                ? t("auth.create.pickNameDesc")
                : t("auth.create.secureItDesc")}
                                    </p>
                                </div>

                                {step === 1 ? (<div className="space-y-6">
                                        <div className="space-y-3">
                                            <Label className="pl-1 text-[11px] font-black uppercase tracking-widest text-zinc-500">{t("auth.usernameLabel")}</Label>
                                            <div className="relative group">
                                                <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400 group-focus-within:text-purple-500 transition-colors"/>
                                                <Input autoFocus placeholder={t("auth.usernamePlaceholder")} value={username} onChange={e => setUsername(e.target.value)} className="pl-12 h-16 rounded-[24px] bg-white/50 dark:bg-zinc-900/50 border-black/5 dark:border-white/5 focus:ring-4 focus:ring-purple-500/10 text-lg transition-all"/>
                                            </div>
                                        </div>
                                        <Button disabled={username.length < 2} onClick={() => setStep(2)} className="w-full h-16 rounded-[24px] bg-purple-600 hover:bg-purple-700 text-white text-lg font-bold shadow-xl shadow-purple-500/20">
                                            {t("common.continue")}
                                            <ArrowRight className="h-5 w-5 ml-2"/>
                                        </Button>
                                    </div>) : (<form onSubmit={handleCreateFinal} className="space-y-6">
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between mb-1">
                                                    <Label className="pl-1 text-[11px] font-black uppercase tracking-widest text-zinc-500">{t("auth.masterPasswordLabel")}</Label>
                                                    <button type="button" onClick={() => {
                    const gen = generateSecurePassword();
                    setPassword(gen);
                    setConfirmPassword(gen);
                    toast.success(t("auth.passwordGenerated"));
                }} className="text-[11px] font-black uppercase tracking-widest text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 transition-colors">
                                                        {t("auth.generatePassword")}
                                                    </button>
                                                </div>
                                                <div className="relative group">
                                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400 group-focus-within:text-purple-500 transition-colors"/>
                                                    <Input type={showPassword ? "text" : "password"} placeholder={t("auth.createPasswordPlaceholder")} value={password} onChange={e => setPassword(e.target.value)} className="px-12 h-16 rounded-[24px] bg-white/50 dark:bg-zinc-900/50 border-black/5 dark:border-white/5 focus:ring-4 focus:ring-purple-500/10 text-lg transition-all"/>
                                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                                                        {showPassword ? <EyeOff className="h-5 w-5"/> : <Eye className="h-5 w-5"/>}
                                                    </button>
                                                </div>
                                                <PasswordStrengthIndicator password={password}/>
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="pl-1 text-[11px] font-black uppercase tracking-widest text-zinc-500">{t("auth.confirmPasswordLabel")}</Label>
                                                <div className="relative group">
                                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400 group-focus-within:text-purple-500 transition-colors"/>
                                                    <Input type={showPassword ? "text" : "password"} placeholder={t("auth.confirmPasswordPlaceholder")} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="px-12 h-16 rounded-[24px] bg-white/50 dark:bg-zinc-900/50 border-black/5 dark:border-white/5 focus:ring-4 focus:ring-purple-500/10 text-lg transition-all"/>
                                                </div>
                                            </div>
                                        </div>

                                        <AuthLoginHelpNote />
                                        <AuthSessionPolicyNotice />

                                        <div className="p-4 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex gap-4">
                                            <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5"/>
                                            <div className="space-y-3">
                                                <p className="text-xs text-amber-600 dark:text-amber-400 font-bold leading-relaxed">
                                                    {t("auth.passwordRecoveryWarning")}
                                                </p>
                                                <p className="text-xs text-amber-700 dark:text-amber-300 font-semibold leading-relaxed">
                                                    {keyOwnershipReminder} {keyRecoveryReminder}
                                                </p>
                                                <div className="flex items-start space-x-4 pt-1">
                                                    <Checkbox id="acknowledge-create" checked={acknowledged} onCheckedChange={(checked) => setAcknowledged(checked as boolean)} className="h-4 w-4 rounded border-amber-500/50 data-[state=checked]:bg-amber-500 -ml-1"/>
                                                    <label htmlFor="acknowledge-create" className="text-[10px] font-black uppercase tracking-wider text-amber-600/80 dark:text-amber-400/80 cursor-pointer leading-tight">
                                                        {t("auth.acknowledgeKeyResponsibility")}
                                                    </label>
                                                </div>
                                            </div>
                                        </div>

                                        <FlashMessage message={authError} onClose={() => setAuthError(null)} className="mt-4"/>

                                        <Button type="submit" disabled={isLoading || password !== confirmPassword || !isIdentityPassphrasePolicyCompliant(password as Passphrase) || !acknowledged} className="w-full h-16 rounded-[24px] bg-purple-600 hover:bg-purple-700 text-white text-lg font-bold shadow-xl shadow-purple-500/20 disabled:opacity-50 relative overflow-hidden group">
                                            {isLoading ? (<div className="flex items-center gap-2">
                                                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                                                        <Sparkles className="h-5 w-5"/>
                                                    </motion.div>
                                                    <span>{t("auth.generating")}</span>
                                                    
                                                </div>) : (t("auth.generateSafeIdentity"))}

                                            {isLoading && (<motion.div initial={{ x: "-100%" }} animate={{ x: "100%" }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"/>)}
                                        </Button>

                                    </form>)}
                            </motion.div>)}

                        {mode === "login" && (<motion.div key={`login-step-${step}`} initial="enter" animate="center" exit="exit" variants={variants} custom={step} transition={{ type: "spring", stiffness: 300, damping: 30 }} className="w-full space-y-4">
                                <div className="text-center space-y-1">
                                    <h2 className="text-2xl font-black tracking-tighter text-zinc-900 dark:text-white">
                                        {t("auth.login.welcomeBackTitle")}
                                    </h2>
                                    <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium text-balance">
                                        {isPasswordlessNativeOnly
                ? t("auth.login.welcomeBackPasswordRepair", { profile: storedUsernameHint || boundProfileLabel })
                : hasStoredIdentity
                    ? t("auth.login.welcomeBackUnlockNamed", { profile: storedUsernameHint || boundProfileLabel })
                    : hasLocalAccountEvidence
                        ? t("auth.login.welcomeBackLocalEvidence")
                        : t("auth.login.welcomeBackDesc")}
                                    </p>
                                </div>

                                <SecurityLiteracyNote className="mt-2" />

                                <div className="space-y-4">
                                        <div className="flex bg-black/5 dark:bg-white/5 rounded-2xl p-1 relative z-10">
                                            <button type="button" onClick={() => setLoginTab("username")} className={cn("flex-1 py-2.5 text-sm font-bold rounded-xl transition-all", loginTab === "username"
                ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow shadow-black/5"
                : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300")}>
                                                {t("auth.login.tabPassword")}
                                            </button>
                                            <button type="button" onClick={() => setLoginTab("key")} className={cn("flex-1 py-2.5 text-sm font-bold rounded-xl transition-all", loginTab === "key" ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow shadow-black/5" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300")}>
                                                {t("auth.login.tabImportKey")}
                                            </button>
                                        </div>

                                        {!hasLocalAccountEvidence ? (<p className="px-1 text-xs text-zinc-500 dark:text-zinc-400">
                                                {t("auth.login.deviceLocalHint")}
                                                {" "}
                                                <button type="button" onClick={() => handleGreenfieldAuthEntry("restore")} className="font-semibold text-violet-600 underline underline-offset-2 dark:text-violet-300">
                                                    {t("auth.login.openRestorePage")}
                                                </button>
                                            </p>) : null}

                                        {needsDevicePasswordSetupGuide ? (<p className="rounded-xl border border-violet-500/25 bg-violet-500/5 px-3 py-2 text-xs text-violet-800 dark:text-violet-200">
                                                {t("auth.login.devicePasswordMissingGuide")}
                                            </p>) : null}

                                        {isPasswordlessNativeOnly && loginTab === "username" ? (<p className="rounded-xl border border-violet-500/20 bg-violet-500/5 px-3 py-2 text-xs text-violet-800 dark:text-violet-200">
                                                {t("auth.login.passwordRepairHint")}
                                            </p>) : null}

                                        {isPasswordlessNativeOnly && loginTab === "key" && !needsDevicePasswordSetupGuide ? (<p className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                                                {t("auth.login.passwordlessKeyHint")}
                                            </p>) : null}

                                        {loginTab === "key" ? (<>
                                                {importKeyGuideStep === "set_device_password" ? (<>
                                                        <div className="space-y-2">
                                                            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                                                {t("auth.login.setDevicePasswordTitle")}
                                                            </h3>
                                                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                                                {t("auth.login.setDevicePasswordDesc")}
                                                            </p>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label className="pl-1 text-[11px] font-black uppercase tracking-widest text-zinc-500">
                                                                {t("auth.login.newDevicePassword")}
                                                            </Label>
                                                            <div className="relative group">
                                                                <Lock className={cn("absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400", authIconFocusClass)}/>
                                                                <Input autoFocus type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder={t("auth.login.setPasswordPlaceholder")} value={password} onChange={e => setPassword(e.target.value)} className={cn(authCompactInputClass, authInputFocusRingClass)}/>
                                                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                                                                    {showPassword ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label className="pl-1 text-[11px] font-black uppercase tracking-widest text-zinc-500">
                                                                {t("auth.login.confirmDevicePassword")}
                                                            </Label>
                                                            <Input type={showPassword ? "text" : "password"} autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={cn(authCompactInputClass, authInputFocusRingClass)}/>
                                                        </div>
                                                        <Button disabled={isLoading} onClick={() => {
                        void handleContinueImportKey();
                    }} className={authPrimaryButtonClass}>
                                                            {t("auth.login.setPasswordAndUnlock")}
                                                        </Button>
                                                        <Button type="button" variant="outline" disabled={isLoading} onClick={() => {
                        void handleSkipDevicePasswordSetup();
                    }} className="w-full h-12 rounded-2xl">
                                                            {t("auth.login.skipDevicePassword")}
                                                        </Button>
                                                        <button type="button" className="w-full text-center text-xs text-zinc-500 underline underline-offset-2" onClick={() => {
                        setImportKeyGuideStep("enter_key");
                        setPassword("");
                        setConfirmPassword("");
                    }}>
                                                            {t("auth.login.backToPrivateKey")}
                                                        </button>
                                                    </>) : (<>
                                                <div className="space-y-2">
                                                    <Label className="pl-1 text-[11px] font-black uppercase tracking-widest text-zinc-500">{t("identity.privateKey")}</Label>
                                                    {!isPasswordlessNativeOnly ? (<p className="px-1 text-xs text-zinc-500 dark:text-zinc-400">
                                                            {hasLocalAccountEvidence
                            ? t("auth.import.privateKeyReturningHelp")
                            : t("auth.import.privateKeyHelp")}
                                                        </p>) : null}
                                                    <div className="relative group">
                                                        <Key className={cn("absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400", authIconFocusClass)}/>
                                                        <input autoFocus type="password" placeholder="nsec1..." value={privateKey} onChange={e => {
                        setPrivateKey(e.target.value);
                        setRetiredKeyReuseAcknowledged(false);
                    }} className={cn("flex w-full border ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50", authCompactInputClass, authInputFocusRingClass)}/>
                                                    </div>
                                                </div>
                                                <SecurityLiteracyNote compact className="mt-1" />
                                                {hasStoredIdentity && !(needsDevicePasswordSetupGuide && importKeyGuideStep === "enter_key") ? (<div className="space-y-2">
                                                        <Label className="pl-1 text-[11px] font-black uppercase tracking-widest text-zinc-500">
                                                            {t("auth.login.optionalMasterPassword")}
                                                        </Label>
                                                        <div className="relative group">
                                                            <Lock className={cn("absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400", authIconFocusClass)}/>
                                                            <Input type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder={t("auth.login.setPasswordPlaceholder")} value={password} onChange={e => setPassword(e.target.value)} className={cn(authCompactInputClass, authInputFocusRingClass)}/>
                                                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                                                                {showPassword ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
                                                            </button>
                                                        </div>
                                                        <p className="px-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                                                            {t("auth.login.optionalMasterPasswordHint")}
                                                        </p>
                                                    </div>) : (<AuthLoginHelpNote />)}
                                                {isRetiredImportKey ? (<div className="rounded-3xl border border-amber-500/25 bg-amber-500/10 p-4">
                                                        <div className="flex gap-3">
                                                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500"/>
                                                            <div className="space-y-3">
                                                                <p className="text-xs font-semibold leading-relaxed text-amber-700 dark:text-amber-300">
                                                                        {t("auth.import.retiredKeyWarning")}
                                                                    </p>
                                                                <div className="flex items-start space-x-3">
                                                                    <Checkbox id="acknowledge-retired-import" checked={retiredKeyReuseAcknowledged} onCheckedChange={(checked) => setRetiredKeyReuseAcknowledged(Boolean(checked))} className="mt-0.5 h-4 w-4 rounded border-amber-500/50 data-[state=checked]:bg-amber-500"/>
                                                                    <label htmlFor="acknowledge-retired-import" className="cursor-pointer text-[11px] font-black uppercase tracking-wider text-amber-700/90 dark:text-amber-300/90">
                                                                        {t("auth.import.retiredKeyAcknowledge")}
                                                                    </label>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>) : null}
                                                {needsDevicePasswordSetupGuide ? (<p className="px-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                                                        {t("auth.login.keyFirstGuide")}
                                                    </p>) : null}
                                                <Button disabled={isLoading || privateKey.length < 10 || (isRetiredImportKey && !retiredKeyReuseAcknowledged)} onClick={() => {
                        void handleContinueImportKey();
                    }} className={authPrimaryButtonClass}>
                                                    {isLoading ? (<motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                                                            <Sparkles className="h-5 w-5"/>
                                                        </motion.div>) : (<>
                                                            {needsDevicePasswordSetupGuide
                            ? t("auth.login.continueWithKey")
                            : hasStoredIdentity
                                ? t("auth.login.unlockWithKey")
                                : t("common.continue")}
                                                            <ArrowRight className="h-5 w-5 ml-2"/>
                                                        </>)}
                                                </Button>
                                                <FlashMessage message={authError} onClose={() => setAuthError(null)} className="mt-4"/>
                                                    </>)}
                                            </>) : (<>
                                                {assistantEntry?.hasSavedUnlock && !needsDevicePasswordSetupGuide ? (
                                                    <AuthAssistantPanel
                                                        entry={assistantEntry}
                                                        isBusy={assistantBusy || isLoading}
                                                        onUnlock={() => { void handleAssistantUnlock(); }}
                                                        className="mb-2"
                                                    />
                                                ) : null}
                                                {showAssistantSavePrompt ? (
                                                    <AuthAssistantSavePrompt
                                                        isBusy={assistantBusy}
                                                        onSave={() => { void handleSaveAssistantUnlock(); }}
                                                        onDismiss={dismissAssistantSavePrompt}
                                                    />
                                                ) : null}
                                                <form onSubmit={handleLoginUsername} className="space-y-4">
                                                    <div className="space-y-1.5">
                                                        <Label className="pl-1 text-[11px] font-black uppercase tracking-widest text-zinc-500">
                                                            {t("auth.localLoginAssist.setupPasswordLabel")}
                                                        </Label>
                                                        <div className="relative group">
                                                            <Lock className={cn("absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400", authIconFocusClass)}/>
                                                            <Input autoFocus name="password" autoComplete="current-password" type={showPassword ? "text" : "password"} placeholder={t("auth.enterPasswordPlaceholder")} value={password} onChange={e => setPassword(e.target.value)} className={cn(authCompactInputClass, authInputFocusRingClass)}/>
                                                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                                                                {showPassword ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <AuthLoginHelpNote />

                                                    <Button type="submit" disabled={isLoading} className={authPrimaryButtonClass}>
                                                        {isLoading ? (<motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                                                                <Sparkles className="h-5 w-5"/>
                                                            </motion.div>) : (t("auth.login.submit"))}
                                                    </Button>

                                                    <FlashMessage message={authError} onClose={() => setAuthError(null)} className="mt-4"/>
                                                </form>
                                            </>)}
                                </div>
                            </motion.div>)}

                        {mode === "restore" && (<motion.div key="restore" initial="enter" animate="center" exit="exit" variants={variants} transition={{ type: "spring", stiffness: 300, damping: 30 }} className="w-full">
                                <AuthScreenRestorePage onNavigateToLogin={() => {
                setLoginTab("key");
                setMode("login");
            }}/>
                            </motion.div>)}
                    </AnimatePresence>

                    {activeSessionConflict ? (<AccountActiveInOtherProfileInline incomingPublicKeyHex={activeSessionConflict.incomingPublicKeyHex} activeProfileLabel={activeSessionConflict.activeProfileLabel} onClose={() => {
                setActiveSessionConflict(null);
                setPendingAuthAction(null);
                setAuthError(null);
            }}/>) : null}

                    {accountConflict && pendingAuthAction ? (<ProfileSlotAccountConflictInline profileLabel={boundProfileLabel} occupantPublicKeyHex={accountConflict.occupantPublicKeyHex} incomingPublicKeyHex={pendingAuthAction.kind === "import_key"
                ? derivePublicKeyHex(pendingAuthAction.privateKeyHex)
                : accountConflict.occupantPublicKeyHex} intent={pendingAuthAction.kind === "create" ? "create_account" : "import_account"} isBusy={isConflictBusy || isLoading} canOpenAnotherWindow={hasNativeRuntime()} onOpenAnotherWindow={() => { void handleOpenAnotherProfileWindow(); }} onClearWindow={() => { void clearWindowAndRetryLogin(false); }} onExportAndClear={() => { void clearWindowAndRetryLogin(true); }} onClose={() => {
                setAccountConflict(null);
                setPendingAuthAction(null);
            }}/>) : null}

                    {lastArchiveResult !== null ? (<ProfileArchiveResultInline result={lastArchiveResult} profileLabel={boundProfileLabel} onClose={() => setLastArchiveResult(null)}/>) : null}
                </div>

                <div className="px-6 py-4 bg-black/5 dark:bg-white/5 border-t border-black/[0.03] dark:border-white/[0.03] flex items-center justify-center gap-6">
                    <div className="flex items-center gap-2 opacity-40 hover:opacity-100 transition-opacity cursor-help group/tip">
                        <Shield className="h-4 w-4 text-emerald-500"/>
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t("auth.footer.selfCustody")}</span>
                        
                    </div>
                    <div className="h-4 w-px bg-zinc-300 dark:bg-zinc-700"/>
                    <div className="flex items-center gap-2 opacity-40 hover:opacity-100 transition-opacity cursor-help group/tip">
                        <UserCheck className="h-4 w-4 text-purple-500"/>
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t("auth.footer.anonymous")}</span>
                    </div>
                </div>
            </Card>

        </div>);
}
