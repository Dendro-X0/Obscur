"use client";

import React from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@dweb/ui-kit";
import { ConfirmDialog } from "@/app/components/ui/confirm-dialog";

export const CommunityMembershipEvidenceToolbar: React.FC<
    Readonly<{
        terminalRecordCount: number;
        onReconcile: () => void;
        onClearTerminalConfirmed: () => void;
        className?: string;
    }>
> = ({ terminalRecordCount, onReconcile, onClearTerminalConfirmed, className }) => {
    const { t } = useTranslation();
    const [isClearTerminalOpen, setIsClearTerminalOpen] = React.useState(false);

    const handleReconcile = (event: React.MouseEvent): void => {
        event.stopPropagation();
        onReconcile();
    };

    const handleOpenClearTerminal = (event: React.MouseEvent): void => {
        event.stopPropagation();
        setIsClearTerminalOpen(true);
    };

    const handleConfirmClearTerminal = (): void => {
        setIsClearTerminalOpen(false);
        onClearTerminalConfirmed();
    };

    return (
        <>
            <div className={className ?? "flex shrink-0 flex-wrap items-center justify-end gap-2"}>
                {terminalRecordCount > 0 ? (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        title={t(
                            "groups.membershipEvidence.clearTerminalDetail",
                            "Removes local leave/expulsion overlay for this community. Members may reappear if relays still list them; leave/expel events can return on sync.",
                        )}
                        onClick={handleOpenClearTerminal}
                        className="h-9 gap-1.5 rounded-xl border-rose-500/30 px-3 text-[10px] font-black uppercase tracking-widest text-rose-700 hover:bg-rose-500/10 dark:border-rose-500/35 dark:text-rose-300 dark:hover:bg-rose-500/15"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                        {t("groups.membershipEvidence.clearTerminal", "Clear terminal cache")}
                    </Button>
                ) : null}
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    title={t(
                        "groups.membershipEvidence.reconcileDetail",
                        "Clear local provisional overlay and reopen the relay subscription. Terminal leave/expel cache is unchanged.",
                    )}
                    onClick={handleReconcile}
                    className="h-9 gap-1.5 rounded-xl border-black/10 px-3 text-[10px] font-black uppercase tracking-widest text-zinc-700 hover:bg-black/[0.04] dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/5"
                >
                    <RefreshCw className="h-3.5 w-3.5" />
                    {t("groups.membershipEvidence.reconcile", "Reconcile membership")}
                </Button>
            </div>
            <ConfirmDialog
                isOpen={isClearTerminalOpen}
                onClose={() => setIsClearTerminalOpen(false)}
                onConfirm={handleConfirmClearTerminal}
                title={t("groups.membershipEvidence.clearTerminalTitle", "Clear terminal membership cache?")}
                description={t(
                    "groups.membershipEvidence.clearTerminalConfirm",
                    "This removes local leave and expulsion records for this community on this device. Re-invited members may become visible again. Relay leave/expel events can restore exclusions after sync. Only use this if you understand the roster was wrong.",
                )}
                confirmLabel={t("groups.membershipEvidence.clearTerminalConfirmAction", "Clear terminal cache")}
                variant="danger"
            />
        </>
    );
};
