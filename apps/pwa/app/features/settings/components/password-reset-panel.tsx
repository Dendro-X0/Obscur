"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import {
    Lock,
    Key,
    ChevronLeft,
    ArrowRight,
    Eye,
    EyeOff,
    AlertCircle,
    CheckCircle2
} from "lucide-react";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { decodePrivateKey } from "@/app/features/auth/utils/decode-private-key";
import { useTranslation } from "react-i18next";
import { toast } from "@/app/components/ui/toast";

/**
 * PasswordResetPanel provides a secure flow for users to reset their master password.
 * It supports verification via the current password or the private key.
 */
export function PasswordResetPanel() {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            <Card
                title={t("settings.security.passwordReset", "Password Management")}
                description="Verify your identity to update your master password. Your master password encrypts your private key locally. If you've forgotten it, you can reset it using your original private key."
            >
                <div className="flex flex-col items-start gap-4 p-1">
                    <Button
                        variant="outline"
                        onClick={() => setIsOpen(true)}
                        className="h-12 px-6 rounded-2xl font-bold bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-purple-500/50 hover:bg-purple-500/5 transition-all flex gap-2"
                    >
                        <Lock className="h-4 w-4 text-purple-500" />
                        {t("settings.security.changePassword", "Change or Reset Password")}
                    </Button>
                </div>
            </Card>

            {isOpen && (
                <PasswordResetModal
                    isOpen={isOpen}
                    onClose={() => setIsOpen(false)}
                    t={t}
                />
            )}
        </>
    );
}

function PasswordResetModal({ isOpen, onClose, t }: { isOpen: boolean; onClose: () => void; t: any }) {
    const { unlockIdentity, changePassphrase, resetPassphraseWithPrivateKey } = useIdentity();
    const [step, setStep] = useState<"method" | "verify" | "new-password" | "success">("method");
    const [method, setMethod] = useState<"password" | "key" | null>(null);
    const [oldPassword, setOldPassword] = useState("");
    const [privateKeyInput, setPrivateKeyInput] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    const handleMethodSelect = (m: "password" | "key") => {
        setMethod(m);
        setStep("verify");
    };

    const handleVerifyOldPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await unlockIdentity({ passphrase: oldPassword });
            setStep("new-password");
        } catch (err) {
            toast.error(t("settings.security.invalidPassword", "Invalid current password"));
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyPrivateKey = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const decoded = decodePrivateKey(privateKeyInput);
            if (decoded) {
                setStep("new-password");
            } else {
                toast.error(t("settings.security.invalidKey", "Invalid private key format"));
            }
        } catch (err) {
            toast.error(t("common.error", "Verification failed"));
        } finally {
            setIsLoading(false);
        }
    };

    const handleCompleteReset = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword.length < 8) {
            toast.error(t("settings.security.passwordTooShort", "Password must be at least 8 characters"));
            return;
        }
        if (newPassword !== confirmPassword) {
            toast.error(t("settings.security.passwordsMismatch", "Passwords do not match"));
            return;
        }

        setIsLoading(true);
        try {
            if (method === "password") {
                await changePassphrase({ oldPassphrase: oldPassword, newPassphrase: newPassword });
            } else if (method === "key") {
                const decoded = decodePrivateKey(privateKeyInput);
                if (decoded) {
                    await resetPassphraseWithPrivateKey({ privateKeyHex: decoded, newPassphrase: newPassword });
                }
            }
            setStep("success");
        } catch (err) {
            toast.error(t("settings.security.resetFailed", "Failed to update security settings"));
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen || !mounted) return null;

    return createPortal(
        <div className="fixed inset-0 z-[200] grid place-items-center p-4 overflow-y-auto">
            <div
                className="fixed inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-xl transition-all animate-in fade-in duration-500"
                onClick={onClose}
            />

            <div className="relative w-full max-w-md z-10 animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
                <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[32px] overflow-hidden shadow-2xl dark:shadow-[0_0_50px_-12px_rgba(0,0,0,1)] flex flex-col">
                    {/* Header */}
                    <div className="p-8 pb-4 border-b border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/50">
                        <div className="flex items-center justify-between">
                            <h2 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">{t("settings.security.resetTitle", "Reset Master Password")}</h2>
                            <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors text-zinc-500">
                                <ArrowRight className="h-5 w-5 rotate-180" />
                            </button>
                        </div>
                        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed">
                            {step === "method" && "Choose how you want to verify your identity."}
                            {step === "verify" && (method === "password" ? "Enter your current password." : "Verify using your backup private key.")}
                            {step === "new-password" && "Set a new strong master password."}
                            {step === "success" && "Your password has been updated."}
                        </p>
                    </div>

                    {/* Content */}
                    <div className="p-8 pb-10 min-h-[300px] flex flex-col justify-center bg-white dark:bg-zinc-950">
                        {step === "method" && (
                            <div className="grid gap-4 w-full">
                                <button
                                    onClick={() => handleMethodSelect("password")}
                                    className="group flex items-center justify-between p-6 rounded-[24px] bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-purple-500/30 dark:hover:border-purple-500/30 hover:bg-purple-500/5 dark:hover:bg-purple-500/5 transition-all text-left shadow-sm"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="h-12 w-12 rounded-2xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center shadow-sm">
                                            <Lock className="h-6 w-6 text-purple-500" />
                                        </div>
                                        <div>
                                            <p className="font-black text-sm text-zinc-900 dark:text-white">{t("settings.security.usePassword", "Use Current Password")}</p>
                                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">I remember my old password.</p>
                                        </div>
                                    </div>
                                    <ArrowRight className="h-5 w-5 text-zinc-400 dark:text-zinc-500 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                                </button>

                                <button
                                    onClick={() => handleMethodSelect("key")}
                                    className="group flex items-center justify-between p-6 rounded-[24px] bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-blue-500/30 dark:hover:border-blue-500/30 hover:bg-blue-500/5 dark:hover:bg-blue-500/5 transition-all text-left shadow-sm"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="h-12 w-12 rounded-2xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center shadow-sm">
                                            <Key className="h-6 w-6 text-blue-500" />
                                        </div>
                                        <div>
                                            <p className="font-black text-sm text-zinc-900 dark:text-white">{t("settings.security.useKey", "Use Private Key")}</p>
                                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">I lost my password but have my key.</p>
                                        </div>
                                    </div>
                                    <ArrowRight className="h-5 w-5 text-zinc-400 dark:text-zinc-500 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                                </button>
                            </div>
                        )}

                        {step === "verify" && method === "password" && (
                            <form
                                onSubmit={handleVerifyOldPassword}
                                className="space-y-6 w-full"
                            >
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500 ml-1">Current Password</Label>
                                    <div className="relative group">
                                        <Input
                                            type={showPassword ? "text" : "password"}
                                            placeholder="••••••••"
                                            value={oldPassword}
                                            onChange={(e) => setOldPassword(e.target.value)}
                                            autoFocus
                                            className="h-14 px-4 rounded-[20px] bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 focus:border-purple-500/30 focus:ring-4 focus:ring-purple-500/5 transition-all text-zinc-900 dark:text-white"
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg text-zinc-400 dark:text-zinc-500"
                                        >
                                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </Button>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <Button type="button" variant="ghost" onClick={() => setStep("method")} className="flex-1 rounded-[16px] h-12 font-bold group text-zinc-600 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800">
                                        <ChevronLeft className="h-4 w-4 mr-1 group-hover:-translate-x-1 transition-transform" />
                                        {t("common.back")}
                                    </Button>
                                    <Button
                                        type="submit"
                                        disabled={!oldPassword || isLoading}
                                        className="flex-1 rounded-[16px] h-12 bg-purple-600 hover:bg-purple-700 text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-purple-500/20"
                                    >
                                        {isLoading ? "Verifying..." : "Confirm Password"}
                                    </Button>
                                </div>
                            </form>
                        )}

                        {step === "verify" && method === "key" && (
                            <form
                                onSubmit={handleVerifyPrivateKey}
                                className="space-y-6 w-full"
                            >
                                <div className="space-y-3">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500 ml-1">Backup Private Key</Label>
                                    <Input
                                        type="password"
                                        placeholder="nsec1... or hex"
                                        value={privateKeyInput}
                                        onChange={(e) => setPrivateKeyInput(e.target.value)}
                                        autoFocus
                                        className="h-14 px-4 rounded-[20px] bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 focus:border-blue-500/30 focus:ring-4 focus:ring-blue-500/5 transition-all font-mono text-sm text-zinc-900 dark:text-white"
                                    />
                                    <div className="p-4 rounded-2xl bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/10 dark:border-blue-500/20 flex gap-3">
                                        <AlertCircle className="h-4 w-4 text-blue-500 shrink-0" />
                                        <p className="text-[10px] font-bold text-blue-400 leading-relaxed uppercase tracking-tight">
                                            Only use this method if you have lost your current master password.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <Button type="button" variant="ghost" onClick={() => setStep("method")} className="flex-1 rounded-[16px] h-12 font-bold group text-zinc-600 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800">
                                        <ChevronLeft className="h-4 w-4 mr-1 group-hover:-translate-x-1 transition-transform" />
                                        {t("common.back")}
                                    </Button>
                                    <Button
                                        type="submit"
                                        disabled={privateKeyInput.length < 10 || isLoading}
                                        className="flex-1 rounded-[16px] h-12 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-blue-500/20"
                                    >
                                        Verify Key
                                    </Button>
                                </div>
                            </form>
                        )}

                        {step === "new-password" && (
                            <form
                                onSubmit={handleCompleteReset}
                                className="space-y-6 w-full"
                            >
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500 ml-1">New Master Password</Label>
                                        <Input
                                            type={showPassword ? "text" : "password"}
                                            placeholder="At least 8 characters"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            autoFocus
                                            className="h-14 px-4 rounded-[20px] bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 focus:ring-4 focus:ring-purple-500/5 transition-all text-lg text-zinc-900 dark:text-white"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500 ml-1">Confirm New Password</Label>
                                        <Input
                                            type={showPassword ? "text" : "password"}
                                            placeholder="Repeat new password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="h-14 px-4 rounded-[20px] bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 focus:ring-4 focus:ring-purple-500/5 transition-all text-lg text-zinc-900 dark:text-white"
                                        />
                                    </div>
                                </div>
                                <Button
                                    type="submit"
                                    disabled={newPassword.length < 8 || newPassword !== confirmPassword || isLoading}
                                    className="w-full rounded-[24px] h-16 bg-emerald-500 hover:bg-emerald-600 text-white font-black uppercase tracking-widest text-sm shadow-xl shadow-emerald-500/20"
                                >
                                    {isLoading ? "Updating Security..." : "Complete Reset"}
                                </Button>
                            </form>
                        )}

                        {step === "success" && (
                            <div className="flex flex-col items-center justify-center text-center space-y-6 py-4 w-full">
                                <div className="h-24 w-24 rounded-[32px] bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center">
                                    <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-zinc-900 dark:text-white">{t("common.success", "Identity Locked")}</h3>
                                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 font-medium">
                                        Your master password has been successfully updated.
                                    </p>
                                </div>
                                <Button onClick={onClose} className="w-full rounded-[24px] h-16 bg-zinc-900 dark:bg-white text-white dark:text-black font-black uppercase tracking-widest text-xs hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors">
                                    {t("common.close")}
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
