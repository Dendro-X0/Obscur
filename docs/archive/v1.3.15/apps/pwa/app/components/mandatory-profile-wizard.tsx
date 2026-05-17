"use client";

import type React from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useProfile } from "@/app/features/profile/hooks/use-profile";
import { useProfilePublisher } from "@/app/features/profile/hooks/use-profile-publisher";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card } from "./ui/card";
import { Loader2, User, Sparkles, CheckCircle2 } from "lucide-react";

/**
 * Mandatory profile setup for users who have an identity but haven't set a username yet.
 * This is shown after onboarding if the username was somehow skipped or for imported accounts.
 */
export const MandatoryProfileWizard: React.FC = () => {
    const { t } = useTranslation();
    const [username, setUsername] = useState<string>("");
    const [isSuccess, setIsSuccess] = useState(false);
    const profile = useProfile();
    const { publishProfile, isPublishing, error: publishError } = useProfilePublisher();

    const handleSave = async (): Promise<void> => {
        if (username.trim().length < 3) return;

        const cleanUsername = username.trim();
        try {
            const success = await publishProfile({ username: cleanUsername });
            if (!success) {
                // The hook already sets the error state
                return;
            }
            if (success) {
                // First update local state
                profile.setUsername({ username: cleanUsername });
                // Show success state locally first to avoid immediate unmount from Gateway if we want to show success
                setIsSuccess(true);
            }
        } catch (e) {
            console.error("Failed to publish profile:", e);
        }
    };

    if (isSuccess) {
        return (
            <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-zinc-50 dark:bg-black overflow-y-auto">
                <div className="w-full max-w-md animate-in fade-in zoom-in duration-500">
                    <Card className="border-emerald-500/20 dark:border-emerald-500/20 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden">
                        <div className="p-8 text-center space-y-6">
                            <div className="flex justify-center">
                                <div className="h-20 w-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                                    <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <h2 className="text-2xl font-bold">{t("onboarding.complete.title")}</h2>
                                <p className="text-sm text-zinc-500">
                                    {t("onboarding.complete.welcomeUser", { username: profile.state.profile.username })}
                                </p>
                            </div>
                            <Button
                                className="w-full h-12 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                                onClick={() => {
                                    // The Gateway will now see the username and show the app
                                    window.location.reload(); // Hard reload to ensure all providers sync up
                                }}
                            >
                                {t("common.getStarted")}
                            </Button>
                        </div>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-zinc-50 dark:bg-black overflow-y-auto">
            <div className="w-full max-w-md animate-in fade-in zoom-in duration-500">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1 bg-gradient-to-r from-transparent via-purple-500/50 to-transparent blur-sm" />

                <Card className="border-black/5 dark:border-white/5 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl shadow-2xl relative overflow-hidden">
                    <div className="absolute -top-12 -right-12 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

                    <div className="p-8 space-y-8 relative">
                        <div className="flex justify-center">
                            <div className="relative group">
                                <div className="absolute -inset-1 bg-gradient-to-tr from-purple-500 to-blue-500 rounded-3xl blur opacity-25 group-hover:opacity-50 transition duration-1000" />
                                <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-white dark:bg-zinc-800 border border-black/5 dark:border-white/5 shadow-inner">
                                    <User className="h-10 w-10 text-zinc-900 dark:text-zinc-100" strokeWidth={1.5} />
                                    <Sparkles className="absolute -top-1 -right-1 h-5 w-5 text-purple-500 animate-pulse" />
                                </div>
                            </div>
                        </div>

                        <div className="text-center space-y-2">
                            <h2 className="text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
                                {t("onboarding.username.title")}
                            </h2>
                            <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium leading-relaxed max-w-[280px] mx-auto">
                                {t("onboarding.username.subtitle")}
                            </p>
                        </div>

                        {publishError && (
                            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-center text-xs font-bold text-red-600 dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-400 animate-in shake duration-500">
                                {publishError}
                            </div>
                        )}

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500 ml-1">
                                    {t("onboarding.username.label")}
                                </Label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-bold transition-colors group-focus-within:text-purple-500">@</div>
                                    <Input
                                        type="text"
                                        autoFocus
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                                        placeholder={t("onboarding.username.placeholder")}
                                        maxLength={20}
                                        className="h-14 pl-10 bg-black/[0.02] dark:bg-white/[0.02] border-transparent focus-visible:bg-white dark:focus-visible:bg-zinc-950 transition-all rounded-2xl text-lg font-bold tracking-tight"
                                    />
                                </div>
                                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 ml-1 font-medium italic">
                                    {t("onboarding.username.help")}
                                </p>
                            </div>

                            <Button
                                type="button"
                                onClick={() => void handleSave()}
                                disabled={username.length < 3 || isPublishing}
                                className="w-full h-14 rounded-2xl text-base font-bold shadow-xl shadow-purple-500/20 transition-all hover:scale-[1.02] hover:shadow-purple-500/30 active:scale-95 flex items-center justify-center gap-2"
                            >
                                {isPublishing ? (
                                    <>
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                        <span>Saving Profile...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Complete Setup</span>
                                        <Sparkles className="h-4 w-4" />
                                    </>
                                )}
                            </Button>
                        </div>

                        <div className="text-center">
                            <p className="text-[10px] text-zinc-400 dark:text-zinc-600 font-medium uppercase tracking-[0.2em]">
                                Secure Identity Powered by Nostr
                            </p>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
};
