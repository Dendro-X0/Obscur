"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
    QrCode,
    ScanLine,
    Search,
    Settings as SettingsIcon,
    X,
} from "lucide-react";
import {
    Button,
} from "@dweb/ui-kit";
import { cn } from "@/app/lib/utils";
import { QRCodeGenerator } from "@/app/components/invites/qr-code-generator";
import { InviteLinkCreator } from "@/app/components/invites/invite-link-creator";
import { QRCodeScanner } from "@/app/components/invites/qr-code-scanner";
import { InviteLinkManager } from "@/app/components/invites/invite-link-manager";
import { ConnectionImportExport } from "@/app/components/invites/connection-import-export";
import { useRouter } from "next/navigation";

interface AddConnectionModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

type TabId = "my-card" | "scan" | "manage";

export function AddConnectionModal({ open, onOpenChange }: AddConnectionModalProps) {
    const { t } = useTranslation();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<TabId>("my-card");
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!open || !mounted) return null;

    const tabs: { id: TabId; label: string; icon: any }[] = [
        { id: "my-card", label: t("invites.myCard"), icon: QrCode },
        { id: "scan", label: t("invites.addFriend"), icon: ScanLine },
        { id: "manage", label: t("invites.manage"), icon: SettingsIcon },
    ];

    return createPortal(
        <div className="fixed inset-0 z-[2000] grid place-items-center p-4 sm:p-6 lg:p-10 pointer-events-none">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-md animate-in fade-in duration-300 pointer-events-auto"
                onClick={() => onOpenChange(false)}
            />

            {/* Modal Body */}
            <div className="relative w-full max-w-4xl bg-background border border-border/50 rounded-[32px] overflow-hidden shadow-2xl modal-transition flex flex-col pointer-events-auto max-h-[90vh]">
                {/* Header */}
                <div className="p-6 pb-2 border-b border-border/10 bg-muted/5 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-black">{t("invites.title")}</h2>
                        <p className="text-xs text-muted-foreground mt-1">
                            Share your identity or connect with others securely.
                        </p>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onOpenChange(false)}
                        className="rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                    >
                        <X className="h-5 w-5" />
                    </Button>
                </div>

                <div className="w-full flex flex-col flex-1 overflow-hidden">
                    {/* Tabs */}
                    <div className="px-6 py-2 bg-muted/5 border-b border-border/10">
                        <div className="flex items-center bg-muted/50 p-1 w-full sm:w-min justify-start rounded-xl gap-1">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={cn(
                                        "flex items-center rounded-lg font-bold text-xs py-1.5 px-3 whitespace-nowrap transition-all",
                                        activeTab === tab.id
                                            ? "bg-white dark:bg-background text-foreground shadow-sm border border-border/30 dark:border-border/50"
                                            : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                                    )}
                                >
                                    <tab.icon className={cn("h-3.5 w-3.5 mr-2", activeTab === tab.id ? "text-primary" : "opacity-60")} />
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="p-6 overflow-y-auto scrollbar-immersive flex-1">
                        {activeTab === "my-card" && (
                            <div className="mt-0 space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">{t("invites.generateQr")}</h3>
                                        <QRCodeGenerator />
                                    </div>
                                    <div className="space-y-4">
                                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">{t("invites.createLink")}</h3>
                                        <InviteLinkCreator />
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === "scan" && (
                            <div className="mt-0 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="mx-auto max-w-xl space-y-6">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">{t("invites.scanQr")}</h3>
                                        <Button variant="ghost" size="sm" onClick={() => { onOpenChange(false); router.push("/search"); }} className="text-[10px] font-black text-primary hover:bg-primary/5 px-4 h-8 rounded-full">
                                            <Search className="h-3 w-3 mr-2" />
                                            SEARCH BY PUBKEY
                                        </Button>
                                    </div>
                                    <div className="bg-muted/20 rounded-3xl overflow-hidden border border-border/50 shadow-inner">
                                        <QRCodeScanner />
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === "manage" && (
                            <div className="mt-0 space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">{t("invites.manageLinks")}</h3>
                                        <InviteLinkManager />
                                    </div>
                                    <div className="space-y-4">
                                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">{t("invites.importExport")}</h3>
                                        <ConnectionImportExport />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-4 bg-muted/5 border-t border-border/10 flex justify-end">
                    <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="rounded-xl font-bold border-border hover:bg-muted text-foreground px-6 h-10">
                        {t("common.close")}
                    </Button>
                </div>
            </div>
        </div>,
        document.body
    );
}
