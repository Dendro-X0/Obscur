"use client";

import React, { useState, useCallback } from "react";
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
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Card } from "@/app/components/ui/card";
import { Label } from "@/app/components/ui/label";
import { cn } from "@/app/lib/utils";
import { useIdentity } from "../hooks/use-identity";
import { useProfilePublisher } from "@/app/features/profile/hooks/use-profile-publisher";
import { useTranslation } from "react-i18next";
import { toast } from "@/app/components/ui/toast";
import type { Passphrase } from "@dweb/crypto/passphrase";
import { PinLockService } from "../services/pin-lock-service";
import { decodePrivateKey } from "../utils/decode-private-key";
import { LanguageSelector } from "@/app/components/language-selector";
import { useProfile } from "@/app/features/profile/hooks/use-profile";
import { Checkbox } from "@/app/components/ui/checkbox";

const generateRandomCode = (): string => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No O, 0, I, 1
    let result = "";
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `OBSCUR-${result}`;
};

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

type AuthMode = "welcome" | "create" | "login";

export function AuthScreen() {
    const { t } = useTranslation();
    const identity = useIdentity();
    const profile = useProfile();
    const profilePublisher = useProfilePublisher();

    const [mode, setMode] = useState<AuthMode>("welcome");
    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(true);
    const [loginTab, setLoginTab] = useState<"username" | "key">("username");
    const [authError, setAuthError] = useState<string | null>(null);

    // Form states
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [privateKey, setPrivateKey] = useState("");

    const handleBack = () => {
        if (step > 1) {
            setStep(step - 1);
        } else {
            setMode("welcome");
            resetForm();
        }
    };

    const resetForm = () => {
        setStep(1);
        setUsername("");
        setPassword("");
        setConfirmPassword("");
        setPrivateKey("");
        setAuthError(null);
    };

    const handleCreateFinal = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!password || password !== confirmPassword) {
            toast.error("Passwords do not match");
            return;
        }
        if (password.length < 8) {
            toast.error("Password must be at least 8 characters");
            return;
        }

        setIsLoading(true);
        try {
            await identity.createIdentity({
                passphrase: password as Passphrase,
                username
            });

            const state = identity.getIdentitySnapshot();
            if (state.publicKeyHex && state.privateKeyHex) {
                // Set Pin/Password for future quick unlocks
                await PinLockService.setPin({
                    publicKeyHex: state.publicKeyHex,
                    privateKeyHex: state.privateKeyHex,
                    pin: password
                });

                // Generate and publish invite code
                const inviteCode = generateRandomCode();
                await profilePublisher.publishProfile({
                    username,
                    inviteCode
                }).catch(console.error);

                // Handle Remember Me logic (TODO: Persist password/token if web)
                if (rememberMe) {
                    localStorage.setItem("obscur_remember_me", "true");
                    // On Web we might store the password for auto-unlock, 
                    // though this has security trade-offs as per the plan.
                    localStorage.setItem("obscur_auth_token", password);
                }

                // Persist profile locally as well
                profile.setUsername({ username });
                profile.setInviteCode({ inviteCode });

                toast.success("Identity Secured!");
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to create account");
        } finally {
            setIsLoading(false);
        }
    };

    const handleLoginUsername = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!username || !password) {
            toast.error("Please fill in all fields");
            return;
        }

        setIsLoading(true);
        try {
            const stored = identity.state.stored;
            if (!stored) {
                setAuthError("No local account found. Please import your private key.");
                setIsLoading(false);
                return;
            }
            if (stored.username?.toLowerCase() !== username.toLowerCase()) {
                setAuthError("Invalid username or password");
                setIsLoading(false);
                return;
            }

            await identity.unlockIdentity({ passphrase: password as Passphrase });

            const state = identity.getIdentitySnapshot();
            if (state.publicKeyHex && state.privateKeyHex) {
                if (rememberMe) {
                    localStorage.setItem("obscur_remember_me", "true");
                    localStorage.setItem("obscur_auth_token", password);
                }
                toast.success("Welcome Back!");
            }
        } catch (error) {
            setAuthError(error instanceof Error ? error.message : "Login failed");
        } finally {
            setIsLoading(false);
        }
    };

    const handleLoginFinal = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!privateKey || !password) {
            toast.error("Please fill in all fields");
            return;
        }

        setIsLoading(true);
        try {
            const keyToUse = decodePrivateKey(privateKey);
            if (!keyToUse) {
                toast.error("Invalid key format");
                setIsLoading(false);
                return;
            }

            await identity.importIdentity({
                privateKeyHex: keyToUse,
                passphrase: password as Passphrase,
                username: username || undefined
            });

            const state = identity.getIdentitySnapshot();
            if (state.publicKeyHex && state.privateKeyHex) {
                await PinLockService.setPin({
                    publicKeyHex: state.publicKeyHex,
                    privateKeyHex: state.privateKeyHex,
                    pin: password
                });

                if (rememberMe) {
                    localStorage.setItem("obscur_remember_me", "true");
                    localStorage.setItem("obscur_auth_token", password);
                }

                toast.success("Welcome Back!");
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Login failed");
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
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-zinc-50 dark:bg-black p-4 overflow-y-auto">
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
                    <AnimatePresence mode="wait">
                        {mode !== "welcome" && (
                            <motion.button
                                key="back-button"
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                onClick={handleBack}
                                className="absolute top-8 left-8 p-3 rounded-2xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 group"
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
                                        className="h-16 rounded-[24px] border-black/10 dark:border-white/10 bg-white/50 hover:bg-white dark:bg-zinc-900/50 dark:hover:bg-zinc-900 text-lg font-bold transition-all"
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
                                            <p className="text-xs text-amber-600 dark:text-amber-400 font-bold leading-relaxed">
                                                There is no password recovery. If you lose this password and your device, your account is gone forever.
                                            </p>
                                        </div>

                                        {authError && (
                                            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex gap-3 text-red-600 dark:text-red-400 items-start">
                                                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                                                <p className="text-sm font-bold leading-relaxed">{authError}</p>
                                            </div>
                                        )}

                                        <Button
                                            type="submit"
                                            disabled={isLoading || password !== confirmPassword || password.length < 8}
                                            className="w-full h-16 rounded-[24px] bg-purple-600 hover:bg-purple-700 text-white text-lg font-bold shadow-xl shadow-purple-500/20 disabled:opacity-50"
                                        >
                                            {isLoading ? "Generating..." : "Generate Safe Identity"}
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
                                        {step === 1 ? "Welcome Back" : "Set App Password"}
                                    </h2>
                                    <p className="text-zinc-500 dark:text-zinc-400 font-medium">
                                        {step === 1
                                            ? "Log in or import your identity."
                                            : "Protect your local session."}
                                    </p>
                                </div>

                                {step === 1 ? (
                                    <div className="space-y-6">
                                        <div className="flex bg-black/5 dark:bg-white/5 rounded-2xl p-1 relative z-10">
                                            <button
                                                type="button"
                                                onClick={() => setLoginTab("username")}
                                                className={cn("flex-1 py-3 text-sm font-bold rounded-xl transition-all", loginTab === "username" ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow shadow-black/5" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300")}
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

                                        {loginTab === "key" ? (
                                            <>
                                                <div className="space-y-3 mt-4">
                                                    <Label className="pl-1 text-[11px] font-black uppercase tracking-widest text-zinc-500">Private Key</Label>
                                                    <div className="relative group">
                                                        <Key className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400 group-focus-within:text-blue-500 transition-colors" />
                                                        <Input
                                                            autoFocus
                                                            type="password"
                                                            placeholder="nsec1..."
                                                            value={privateKey}
                                                            onChange={e => setPrivateKey(e.target.value)}
                                                            className="px-12 h-16 rounded-[24px] bg-white/50 dark:bg-zinc-900/50 border-black/5 dark:border-white/5 focus:ring-4 focus:ring-blue-500/10 text-lg transition-all"
                                                        />
                                                    </div>
                                                </div>
                                                <Button
                                                    disabled={privateKey.length < 10}
                                                    onClick={() => setStep(2)}
                                                    className="w-full h-16 rounded-[24px] bg-blue-600 hover:bg-blue-700 text-white text-lg font-bold shadow-xl shadow-blue-500/20"
                                                >
                                                    Continue
                                                    <ArrowRight className="h-5 w-5 ml-2" />
                                                </Button>
                                            </>
                                        ) : (
                                            <form onSubmit={handleLoginUsername} className="space-y-6 mt-4">
                                                <div className="space-y-4">
                                                    {authError && (
                                                        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex gap-3 text-red-600 dark:text-red-400 items-start">
                                                            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                                                            <p className="text-sm font-bold leading-relaxed">{authError}</p>
                                                        </div>
                                                    )}
                                                    <div className="space-y-3">
                                                        <Label className="pl-1 text-[11px] font-black uppercase tracking-widest text-zinc-500">Username</Label>
                                                        <div className="relative group">
                                                            <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400 group-focus-within:text-blue-500 transition-colors" />
                                                            <Input
                                                                autoFocus
                                                                placeholder="e.g. Satoshi"
                                                                value={username}
                                                                onChange={e => {
                                                                    setUsername(e.target.value);
                                                                    setAuthError(null);
                                                                }}
                                                                className="pl-12 h-16 rounded-[24px] bg-white/50 dark:bg-zinc-900/50 border-black/5 dark:border-white/5 focus:ring-4 focus:ring-blue-500/10 text-lg transition-all"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-3">
                                                        <Label className="pl-1 text-[11px] font-black uppercase tracking-widest text-zinc-500">Password</Label>
                                                        <div className="relative group">
                                                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400 group-focus-within:text-blue-500 transition-colors" />
                                                            <Input
                                                                type={showPassword ? "text" : "password"}
                                                                placeholder="Your master password"
                                                                value={password}
                                                                onChange={e => {
                                                                    setPassword(e.target.value);
                                                                    setAuthError(null);
                                                                }}
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
                                                <Button
                                                    type="submit"
                                                    disabled={isLoading || !username || !password}
                                                    className="w-full h-16 rounded-[24px] bg-blue-600 hover:bg-blue-700 text-white text-lg font-bold shadow-xl shadow-blue-500/20"
                                                >
                                                    {isLoading ? "Logging in..." : "Log In"}
                                                </Button>
                                            </form>
                                        )}
                                    </div>
                                ) : (
                                    <form onSubmit={handleLoginFinal} className="space-y-6">
                                        <div className="space-y-2">
                                            <Label className="pl-1 text-[11px] font-black uppercase tracking-widest text-zinc-500">App Password</Label>
                                            <div className="relative group">
                                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400 group-focus-within:text-blue-500 transition-colors" />
                                                <Input
                                                    autoFocus
                                                    type={showPassword ? "text" : "password"}
                                                    placeholder="Minimum 8 characters"
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

                                        <div className="flex items-center space-x-3 px-2">
                                            <Checkbox
                                                id="remember-login"
                                                checked={rememberMe}
                                                onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                                                className="h-5 w-5 rounded-lg border-zinc-300 dark:border-zinc-700 data-[state=checked]:bg-blue-600"
                                            />
                                            <label htmlFor="remember-login" className="text-sm font-medium text-zinc-600 dark:text-zinc-400 cursor-pointer">
                                                Keep me logged in on this device
                                            </label>
                                        </div>

                                        {authError && (
                                            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex gap-3 text-red-600 dark:text-red-400 items-start">
                                                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                                                <p className="text-sm font-bold leading-relaxed">{authError}</p>
                                            </div>
                                        )}

                                        <Button
                                            type="submit"
                                            disabled={isLoading || password.length < 8}
                                            className="w-full h-16 rounded-[24px] bg-blue-600 hover:bg-blue-700 text-white text-lg font-bold shadow-xl shadow-blue-500/20"
                                        >
                                            {isLoading ? "Importing..." : "Import Identity"}
                                        </Button>
                                    </form>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <div className="p-6 bg-zinc-50 dark:bg-black/20 border-t border-black/[0.03] dark:border-white/[0.03] text-center">
                    <div className="flex items-center justify-center gap-4 opacity-50 grayscale">
                        <UserCheck className="h-4 w-4" />
                        <Shield className="h-4 w-4" />
                        <Sparkles className="h-4 w-4" />
                    </div>
                </div>
            </Card>
        </div>
    );
}
