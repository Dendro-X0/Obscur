"use client";

import type React from "react";
import { useTranslation } from "react-i18next";
import { Shield, Network, MessageSquare, Settings as SettingsIcon } from "lucide-react";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { IdentityCard } from "@/app/components/identity-card";
import { cn } from "@/app/lib/utils";

interface LockedIdentityViewProps {
    showOnboarding: boolean;
    isStep1Done: boolean;
    isStep2Done: boolean;
    onOpenSettings: () => void;
    onDismissOnboarding: () => void;
}

export const LockedIdentityView: React.FC<LockedIdentityViewProps> = ({
    showOnboarding,
    isStep1Done,
    isStep2Done,
    onOpenSettings,
    onDismissOnboarding,
}) => {
    const { t } = useTranslation();
    return (
        <div className="w-full max-w-lg space-y-6">
            {showOnboarding ? (
                <div className="animate-in fade-in slide-in-from-top-4 duration-700">
                    <Card
                        title={t("messaging.gettingStarted")}
                        description={t("messaging.gettingStartedDesc")}
                        className="w-full overflow-hidden border-purple-500/20 bg-gradient-to-br from-purple-500/[0.05] to-transparent dark:from-purple-500/[0.08]"
                    >
                        <div className="space-y-6 text-left">
                            <div className="grid gap-4">
                                <StepItem
                                    done={isStep1Done}
                                    icon={Shield}
                                    title={t("messaging.unlockIdentity")}
                                    desc={t("messaging.unlockIdentityDesc")}
                                />
                                <StepItem
                                    done={isStep2Done}
                                    icon={Network}
                                    title={t("messaging.connectRelays")}
                                    desc={t("messaging.connectRelaysDesc")}
                                />
                                <StepItem
                                    done={false}
                                    icon={MessageSquare}
                                    title={t("messaging.startAChat")}
                                    desc={t("messaging.startAChatDesc")}
                                />
                            </div>
                            <div className="flex flex-wrap gap-3 pt-2">
                                <Button type="button" onClick={onOpenSettings} className="group">
                                    <SettingsIcon className="mr-2 h-4 w-4 transition-transform group-hover:rotate-45" />
                                    {t("messaging.openSettings")}
                                </Button>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={onDismissOnboarding}
                                >
                                    {t("common.dismiss")}
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>
            ) : null}
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
                <Card
                    title={t("messaging.identityLocked")}
                    description={t("messaging.identityLockedDesc")}
                    className="w-full"
                >
                    <div className="space-y-4">
                        <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                            {t("messaging.passphraseProtectDesc")}
                        </div>
                        <div className="relative rounded-2xl border border-black/5 bg-black/[0.02] p-4 dark:border-white/5 dark:bg-white/[0.02]">
                            <IdentityCard embedded />
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
};

function StepItem({ done, icon: Icon, title, desc }: { done: boolean; icon: any; title: string; desc: string }) {
    return (
        <div className="flex items-start gap-4 transition-opacity group">
            <div
                className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-all duration-500",
                    done
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-400 shadow-[0_0_15px_oklch(0.6_0.2_150_/_0.2)]"
                        : "border-black/5 bg-white text-zinc-400 dark:border-white/5 dark:bg-zinc-900/60 dark:text-zinc-500"
                )}
            >
                <Icon className={cn("h-5 w-5", done ? "animate-in zoom-in-75 duration-500" : "")} />
            </div>
            <div className="min-w-0 space-y-0.5">
                <div className={cn("text-sm font-bold tracking-tight", done ? "text-emerald-700 dark:text-emerald-300" : "text-zinc-900 dark:text-zinc-100")}>
                    {title}
                </div>
                <div className="text-xs font-medium leading-relaxed text-zinc-500 dark:text-zinc-400">
                    {desc}
                </div>
            </div>
            {done && (
                <div className="ml-auto text-emerald-500 dark:text-emerald-400">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/20">
                        <span className="text-[10px] font-bold">✓</span>
                    </div>
                </div>
            )}
        </div>
    );
}
