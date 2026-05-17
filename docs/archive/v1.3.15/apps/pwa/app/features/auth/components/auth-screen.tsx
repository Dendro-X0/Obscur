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
    AlertCircle
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
import {
    getRememberMeStorageKey,
    getAuthTokenScopedStorageKeys,
    getRememberMeScopedStorageKeys,
} from "../utils/auth-storage-keys";
import { useWindowRuntime } from "@/app/features/runtime/services/window-runtime-supervisor";
import { generateRandomInviteCode } from "@/app/features/invites/utils/invite-code-format";
import { logAppEvent } from "@/app/shared/log-app-event";
import { isRetiredIdentityPublicKey } from "../utils/retired-identity-registry";

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

type AuthMode = "welcome" | "create" | "login";

export function AuthScreen() {
    const { t } = useTranslation();
    const identity = useIdentity();
    const runtime = useWindowRuntime();
    const profile = useProfile();
    const identityDiagnostics = identity.getIdentityDiagnostics?.();
    const hasNativeMismatch = identityDiagnostics?.mismatchReason === "native_mismatch";
    const hasStoredIdentity = Boolean(identity.state.stored);

    const [mode, setMode] = useState<AuthMode>("welcome");
    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(true);
    const [loginTab, setLoginTab] = useState<"username" | "key">("username");
    const [authError, setAuthError] = useState<string | null>(null);
    const hasPrivateKeyMismatch = identityDiagnostics?.mismatchReason === "private_key_mismatch"
        || identityDiagnostics?.message?.toLowerCase().includes("does not match stored identity") === true
        || authError?.toLowerCase().includes("does not match stored identity") === true;
    const [acknowledged, setAcknowledged] = useState(false);
    const [retiredKeyReuseAcknowledged, setRetiredKeyReuseAcknowledged] = useState(false);
    const keyOwnershipReminder = "You own your private key. Obscur cannot recover accounts for lost keys or forgotten passwords.";
    const keyRecoveryReminder = "Back up your private key now and verify export in Settings > Identity after login.";

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

    const rememberProfileId = runtime.snapshot.session.profileId;
    const persistRememberMe = useCallback((params: Readonly<{ remember: boolean; token?: string }>) => {
        const rememberKeys = getRememberMeScopedStorageKeys({
            profileId: rememberProfileId,
            includeLegacy: true,
        });
        const tokenKeys = getAuthTokenScopedStorageKeys({
            profileId: rememberProfileId,
            includeLegacy: true,
        });
        const currentRememberKey = getRememberMeStorageKey(rememberProfileId);
        rememberKeys.forEach((key) => {
            if (params.remember) {
                localStorage.setItem(key, "true");
                return;
            }
            if (key === currentRememberKey) {
                localStorage.setItem(key, "false");
                return;
            }
            localStorage.removeItem(key);
        });
        tokenKeys.forEach((key) => {
            if (params.remember && params.token !== undefined && params.token.length > 0) {
                localStorage.setItem(key, params.token);
                return;
            }
            localStorage.removeItem(key);
        });
        const tokenPersisted = params.remember && typeof params.token === "string" && params.token.length > 0;
        logAppEvent({
            name: "auth.remember_me_persisted",
            level: "info",
            scope: { feature: "auth", action: "remember_me" },
            context: {
                profileId: rememberProfileId,
                remember: params.remember,
                tokenPersisted,
                rememberKeyCount: rememberKeys.length,
                tokenKeyCount: tokenKeys.length,
            },
        });
    }, [rememberProfileId]);

    React.useEffect(() => {
        const rememberedValues = getRememberMeScopedStorageKeys({
            profileId: rememberProfileId,
            includeLegacy: true,
        })
            .map((key) => localStorage.getItem(key))
            .filter((value): value is string => value !== null);
        const tokenValues = getAuthTokenScopedStorageKeys({
            profileId: rememberProfileId,
            includeLegacy: true,
        })
            .map((key) => localStorage.getItem(key))
            .filter((value): value is string => value !== null && value.length > 0);
        const currentProfileRememberValue = localStorage.getItem(getRememberMeStorageKey(rememberProfileId));

        if (rememberedValues.includes("true") || tokenValues.length > 0) {
            setRememberMe(true);
        } else if (identity.state.stored) {
            // Existing local identities should default to recoverable login persistence
            // unless a token/remember true value is already present.
            setRememberMe(true);
            logAppEvent({
                name: "auth.remember_me_bootstrap_defaulted_true",
                level: "info",
                scope: { feature: "auth", action: "remember_me" },
                context: {
                    profileId: rememberProfileId,
                    hasStoredIdentity: true,
                    tokenCandidateCount: tokenValues.length,
                    scopedRememberFalse: currentProfileRememberValue === "false",
                },
            });
        } else if (currentProfileRememberValue === "false") {
            setRememberMe(false);
        }
    }, [identity.state.stored, rememberProfileId]);

    React.useEffect(() => {
        if (hasAppliedInitialEntryRouteRef.current) {
            return;
        }
        if (mode !== "welcome" || identity.state.status === "loading") {
            return;
        }
        if (hasNativeMismatch || identity.state.stored) {
            setMode("login");
        }
        hasAppliedInitialEntryRouteRef.current = true;
    }, [hasNativeMismatch, identity.state.status, identity.state.stored, mode]);

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
            setAuthError("Secure storage reset is not available in this runtime.");
            return;
        }
        setIsLoading(true);
        setAuthError(null);
        try {
            await identity.resetNativeSecureStorage();
            toast.success("Secure storage reset. You can now unlock this profile manually.");
        } catch (error) {
            setAuthError(error instanceof Error ? error.message : "Failed to reset secure storage");
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

    const handleContinueImportKey = (): void => {
        setAuthError(null);
        const keyToUse = decodedImportPrivateKey;
        if (!keyToUse) {
            setAuthError("Invalid private key. Enter a valid `nsec` or 64-character hex key.");
            return;
        }
        if (isRetiredImportKey && !retiredKeyReuseAcknowledged) {
            setAuthError("This private key was previously retired on this device. Confirm reactivation before continuing.");
            return;
        }
        setStep(2);
    };

    const handleCreateFinal = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!password || password !== confirmPassword) {
            setAuthError("Passwords do not match");
            return;
        }
        if (password.length < 8) {
            setAuthError("Password must be at least 8 characters");
            return;
        }

        setIsLoading(true);
        try {
            const normalizedUsername = username.trim();
            await runtime.createIdentityForBoundProfile({
                passphrase: password as Passphrase,
                username: normalizedUsername
            });
            // Generate local profile defaults immediately. Relay publish happens after auth.
            const inviteCode = generateRandomInviteCode();

            // Handle Remember Me logic
            persistRememberMe({ remember: rememberMe, token: password });

            // Persist profile locally
            profile.setUsername({ username: normalizedUsername });
            profile.setInviteCode({ inviteCode });
            profile.save();

            toast.success("Identity Secured!");
        } catch (error) {
            setAuthError(error instanceof Error ? error.message : "Failed to create account");
        } finally {
            setIsLoading(false);
        }
    };

    const handleLoginUsername = async (e?: React.FormEvent) => {
        e?.preventDefault();
        const enteredUsername = username.trim();
        if (!enteredUsername || !password) {
            setAuthError("Please fill in all fields");
            return;
        }

        setIsLoading(true);
        try {
            const stored = identity.state.stored;
            if (!stored) {
                setAuthError("No local account exists on this device yet. Import your private key first, then you can use username/password unlock locally.");
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
                setAuthError(t("auth.error.incorrectPassword"));
                setIsLoading(false);
                return;
            }
            persistRememberMe({ remember: rememberMe, token: password });
            toast.success("Welcome Back!");
        } catch (error) {
            setAuthError(error instanceof Error ? error.message : "Invalid password or account error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleLoginFinal = async (e?: React.FormEvent, skipPassword = false) => {
        e?.preventDefault();

        const providedPassword = skipPassword ? "" : password;
        const shouldGenerateDevicePassphrase = skipPassword && rememberMe;
        const importPassphrase = shouldGenerateDevicePassphrase ? generateSecurePassword() : providedPassword;

        if (!privateKey) {
            setAuthError("Private key is required");
            return;
        }

        if (!skipPassword && !password) {
            setAuthError("Please enter a password or skip");
            return;
        }

        setIsLoading(true);
        try {
            const keyToUse = decodePrivateKey(privateKey);
            if (!keyToUse) {
                setAuthError("Invalid key format");
                setIsLoading(false);
                return;
            }
            const importPublicKeyHex = derivePublicKeyHex(keyToUse as PrivateKeyHex);
            if (isRetiredIdentityPublicKey(importPublicKeyHex) && !retiredKeyReuseAcknowledged) {
                setAuthError("This private key was previously retired on this device. Confirm reactivation before importing.");
                setStep(1);
                setIsLoading(false);
                return;
            }

            await runtime.importIdentityForBoundProfile({
                privateKeyHex: keyToUse,
                passphrase: (importPassphrase || "") as Passphrase,
                username: username || undefined
            });
            const canPersistPasswordToken = rememberMe && (importPassphrase || "").trim().length > 0;
            persistRememberMe({
                remember: canPersistPasswordToken,
                token: canPersistPasswordToken ? (importPassphrase || "") as string : undefined,
            });
            if (shouldGenerateDevicePassphrase) {
                logAppEvent({
                    name: "auth.import_generated_device_passphrase",
                    level: "info",
                    scope: { feature: "auth", action: "import_identity" },
                    context: {
                        profileId: rememberProfileId,
                        rememberRequested: rememberMe,
                    },
                });
                toast.info("Key accepted. Device-only unlock was created for this profile.");
            } else {
                toast.info("Key accepted. Restoring account data...");
            }
        } catch (error) {
            setAuthError(error instanceof Error ? error.message : "Failed to import key");
        } finally {
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
                                            Secure Storage Needs Recovery
                                        </p>
                                        <p className="mt-2 text-sm font-medium leading-relaxed text-amber-700 dark:text-amber-200">
                                            {identityDiagnostics?.message ?? "Native auto-unlock was skipped for this profile."}
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
                                            Reset Secure Storage
                                        </Button>
                                        <p className="self-center text-xs font-semibold text-amber-700/80 dark:text-amber-300/80">
                                            You can also continue with your password or private key below.
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
                                            Private Key Mismatch
                                        </p>
                                        <p className="mt-2 text-sm font-medium leading-relaxed text-orange-700 dark:text-orange-200">
                                            {identityDiagnostics?.message ?? authError ?? "The entered private key does not match the account stored on this profile."}
                                        </p>
                                    </div>
                                    <p className="text-xs font-semibold text-orange-700/80 dark:text-orange-300/80">
                                        Import the correct key for this profile, or switch to the intended account before continuing.
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
                                key="welcome"
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

                                <div className="space-y-4">
                                    <h1 className="text-5xl font-black bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-500 dark:from-white dark:via-zinc-200 dark:to-zinc-500 bg-clip-text text-transparent tracking-tighter leading-tight">
                                        Obscur
                                    </h1>
                                    <p className="text-zinc-500 dark:text-zinc-400 text-lg font-medium tracking-tight max-w-[300px] mx-auto leading-relaxed">
                                        The most private way to communicate. Decentralized & anonymous.
                                    </p>
                                </div>

                                <div className="w-full grid grid-cols-1 gap-4 pt-4">
                                    <Button
                                        onClick={() => setMode("create")}
                                        className="h-16 rounded-[24px] bg-zinc-900 hover:bg-black dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black text-lg font-bold group shadow-xl shadow-zinc-500/10"
                                    >
                                        Create New Identity
                                        <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={() => setMode("login")}
                                        className="h-16 rounded-[24px] border-black/10 dark:border-white/10 bg-white/50 hover:bg-black/5 dark:bg-zinc-900/50 dark:hover:bg-white/5 text-lg font-bold transition-all"
                                    >
                                        Log In with Key
                                    </Button>
                                    <div className="flex items-center justify-center gap-2 pt-4">
                                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                        <p className="text-[10px] text-zinc-400 uppercase tracking-[0.2em] font-black">
                                            End-to-End Encrypted Identity
                                        </p>
                                    </div>
                                </div>
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
                                        {step === 1 ? "Pick a Name" : "Secure It"}
                                    </h2>
                                    <p className="text-zinc-500 dark:text-zinc-400 font-medium">
                                        {step === 1
                                            ? "This will be your visible profile name."
                                            : "Set a password to protect your keys."}
                                    </p>
                                </div>

                                {step === 1 ? (
                                    <div className="space-y-6">
                                        <div className="space-y-3">
                                            <Label className="pl-1 text-[11px] font-black uppercase tracking-widest text-zinc-500">Username</Label>
                                            <div className="relative group">
                                                <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400 group-focus-within:text-purple-500 transition-colors" />
                                                <Input
                                                    autoFocus
                                                    placeholder="e.g. Satoshi"
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
                                            Continue
                                            <ArrowRight className="h-5 w-5 ml-2" />
                                        </Button>
                                    </div>
                                ) : (
                                    <form onSubmit={handleCreateFinal} className="space-y-6">
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between mb-1">
                                                    <Label className="pl-1 text-[11px] font-black uppercase tracking-widest text-zinc-500">Master Password</Label>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const gen = generateSecurePassword();
                                                            setPassword(gen);
                                                            setConfirmPassword(gen);
                                                            toast.success("Password generated. Please save it securely.");
                                                        }}
                                                        className="text-[11px] font-black uppercase tracking-widest text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 transition-colors"
                                                    >
                                                        Generate Code
                                                    </button>
                                                </div>
                                                <div className="relative group">
                                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400 group-focus-within:text-purple-500 transition-colors" />
                                                    <Input
                                                        type={showPassword ? "text" : "password"}
                                                        placeholder="Create a strong password"
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
                                                <Label className="pl-1 text-[11px] font-black uppercase tracking-widest text-zinc-500">Confirm</Label>
                                                <div className="relative group">
                                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400 group-focus-within:text-purple-500 transition-colors" />
                                                    <Input
                                                        type={showPassword ? "text" : "password"}
                                                        placeholder="Repeat your password"
                                                        value={confirmPassword}
                                                        onChange={e => setConfirmPassword(e.target.value)}
                                                        className="px-12 h-16 rounded-[24px] bg-white/50 dark:bg-zinc-900/50 border-black/5 dark:border-white/5 focus:ring-4 focus:ring-purple-500/10 text-lg transition-all"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center space-x-3 px-2">
                                            <Checkbox
                                                id="remember-create"
                                                checked={rememberMe}
                                                onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                                                className="h-5 w-5 rounded-lg border-zinc-300 dark:border-zinc-700 data-[state=checked]:bg-purple-600"
                                            />
                                            <label htmlFor="remember-create" className="text-sm font-medium text-zinc-600 dark:text-zinc-400 cursor-pointer">
                                                Keep me logged in on this device
                                            </label>
                                        </div>

                                        <div className="p-4 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex gap-4">
                                            <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                                            <div className="space-y-3">
                                                <p className="text-xs text-amber-600 dark:text-amber-400 font-bold leading-relaxed">
                                                    There is no password recovery. If you lose this password and device, your account may be unrecoverable. You can log in from any device using your private key, so never lose it.
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
                                                        I understand I am responsible for my keys
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
                                                    <span>Generating...</span>
                                                </div>
                                            ) : (
                                                "Generate Safe Identity"
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
                                        {step === 1 ? "Welcome Back" : "Secure Your Session"}
                                    </h2>
                                    <p className="text-zinc-500 dark:text-zinc-400 font-medium text-balance">
                                        {step === 1
                                            ? "Log in or import your identity."
                                            : "You can set a password now, or skip and use your key directly."}
                                    </p>
                                </div>

                                {step === 1 ? (
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
                                                Log In
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setLoginTab("key")}
                                                className={cn("flex-1 py-3 text-sm font-bold rounded-xl transition-all", loginTab === "key" ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow shadow-black/5" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300")}
                                            >
                                                Import Key
                                            </button>
                                        </div>
                                        {!hasStoredIdentity && (
                                            <p className="px-2 text-xs text-zinc-500 dark:text-zinc-400">
                                                Username/password unlock is device-local. Import your private key once on this device to enable it.
                                            </p>
                                        )}

                                        {loginTab === "key" ? (
                                            <>
                                                <div className="space-y-3 mt-4">
                                                    <Label className="pl-1 text-[11px] font-black uppercase tracking-widest text-zinc-500">Private Key</Label>
                                                    <p className="px-1 text-xs text-zinc-500 dark:text-zinc-400">
                                                        Import Key restores an existing account only. If this key has no local or relay-backed account evidence, use Create Account instead.
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
                                                <div className="flex items-center space-x-3 px-2">
                                                    <Checkbox
                                                        id="remember-login-key"
                                                        checked={rememberMe}
                                                        onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                                                        className="h-5 w-5 rounded-lg border-zinc-300 dark:border-zinc-700 data-[state=checked]:bg-blue-600"
                                                    />
                                                    <label htmlFor="remember-login-key" className="text-sm font-medium text-zinc-600 dark:text-zinc-400 cursor-pointer">
                                                        {t("auth.rememberMe", "Keep me logged in on this device")}
                                                    </label>
                                                </div>
                                                {isRetiredImportKey ? (
                                                    <div className="rounded-3xl border border-amber-500/25 bg-amber-500/10 p-4">
                                                        <div className="flex gap-3">
                                                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                                                            <div className="space-y-3">
                                                                <p className="text-xs font-semibold leading-relaxed text-amber-700 dark:text-amber-300">
                                                                    This key was previously marked as retired on this device. Reactivating it can restore prior identity links from relays.
                                                                </p>
                                                                <div className="flex items-start space-x-3">
                                                                    <Checkbox
                                                                        id="acknowledge-retired-import"
                                                                        checked={retiredKeyReuseAcknowledged}
                                                                        onCheckedChange={(checked) => setRetiredKeyReuseAcknowledged(Boolean(checked))}
                                                                        className="mt-0.5 h-4 w-4 rounded border-amber-500/50 data-[state=checked]:bg-amber-500"
                                                                    />
                                                                    <label htmlFor="acknowledge-retired-import" className="cursor-pointer text-[11px] font-black uppercase tracking-wider text-amber-700/90 dark:text-amber-300/90">
                                                                        I understand and want to reactivate this identity on this device
                                                                    </label>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : null}
                                                <Button
                                                    disabled={privateKey.length < 10 || (isRetiredImportKey && !retiredKeyReuseAcknowledged)}
                                                    onClick={handleContinueImportKey}
                                                    className="w-full h-16 rounded-[24px] bg-blue-600 hover:bg-blue-700 text-white text-lg font-bold shadow-xl shadow-blue-500/20"
                                                >
                                                    Continue
                                                    <ArrowRight className="h-5 w-5 ml-2" />
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
                                                            <Label className="pl-1 text-[11px] font-black uppercase tracking-widest text-zinc-500">Username</Label>
                                                            <div className="relative group">
                                                                <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400 group-focus-within:text-blue-500 transition-colors" />
                                                                <Input
                                                                    autoFocus
                                                                    placeholder="e.g. Satoshi"
                                                                    value={username}
                                                                    onChange={e => setUsername(e.target.value)}
                                                                    className="px-12 h-16 rounded-[24px] bg-white/50 dark:bg-zinc-900/50 border-black/5 dark:border-white/5 focus:ring-4 focus:ring-blue-500/10 text-lg transition-all"
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label className="pl-1 text-[11px] font-black uppercase tracking-widest text-zinc-500">Master Password</Label>
                                                            <div className="relative group">
                                                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400 group-focus-within:text-blue-500 transition-colors" />
                                                                <Input
                                                                    type={showPassword ? "text" : "password"}
                                                                    placeholder="Enter your password"
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

                                                    <div className="flex items-center space-x-3 px-2">
                                                        <Checkbox
                                                            id="remember-login-user"
                                                            checked={rememberMe}
                                                            onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                                                            className="h-5 w-5 rounded-lg border-zinc-300 dark:border-zinc-700 data-[state=checked]:bg-blue-600"
                                                        />
                                                        <label htmlFor="remember-login-user" className="text-sm font-medium text-zinc-600 dark:text-zinc-400 cursor-pointer">
                                                            {t("auth.rememberMe", "Keep me logged in on this device")}
                                                        </label>
                                                    </div>

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
                                                            "Log In"
                                                        )}
                                                    </Button>
                                                </form>
                                            </>
                                        )}
                                    </div>
                                ) : (
                                    <form onSubmit={handleLoginFinal} className="space-y-6">
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between mb-1">
                                                <Label className="pl-1 text-[11px] font-black uppercase tracking-widest text-zinc-500">Master Password</Label>
                                            </div>
                                            <div className="relative group">
                                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400 group-focus-within:text-blue-500 transition-colors" />
                                                <Input
                                                    type={showPassword ? "text" : "password"}
                                                    placeholder="Optional: create a new password"
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
                                            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest ml-1 mt-2">
                                                Leave blank to use key-only login. If Remember Me is enabled, a device-only unlock will be created.
                                            </p>
                                        </div>

                                        <FlashMessage
                                            message={authError}
                                            onClose={() => setAuthError(null)}
                                            className="mt-4"
                                        />

                                        <div className="grid grid-cols-2 gap-4">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={(e) => handleLoginFinal(e, true)}
                                                disabled={isLoading}
                                                className="h-16 rounded-[24px] border-black/10 dark:border-white/10"
                                            >
                                                Skip Password
                                            </Button>
                                            <Button
                                                type="submit"
                                                disabled={isLoading || !password}
                                                className="h-16 rounded-[24px] bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xl shadow-blue-500/20"
                                            >
                                                Secure Account
                                            </Button>
                                        </div>
                                    </form>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <div className="px-12 py-8 bg-black/5 dark:bg-white/5 border-t border-black/[0.03] dark:border-white/[0.03] flex items-center justify-center gap-6">
                    <div className="flex items-center gap-2 opacity-40 hover:opacity-100 transition-opacity cursor-help group/tip">
                        <Shield className="h-4 w-4 text-emerald-500" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Self-Custody</span>
                    </div>
                    <div className="h-4 w-px bg-zinc-300 dark:bg-zinc-700" />
                    <div className="flex items-center gap-2 opacity-40 hover:opacity-100 transition-opacity cursor-help group/tip">
                        <UserCheck className="h-4 w-4 text-purple-500" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Anonymous</span>
                    </div>
                </div>
            </Card>
        </div>
    );
}
