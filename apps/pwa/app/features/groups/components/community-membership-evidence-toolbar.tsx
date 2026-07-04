"use client";
import React from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@dweb/ui-kit";
import { ConfirmDialog } from "@/app/components/ui/confirm-dialog";
export const CommunityMembershipEvidenceToolbar: React.FC<Readonly<{
    terminalRecordCount: number;
    onReconcile: () => void;
    onClearTerminalConfirmed: () => void;
    className?: string;
}>> = ({ terminalRecordCount, onReconcile, onClearTerminalConfirmed, className }) => {
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
    return (<>
            <div className={className ?? "flex shrink-0 flex-wrap items-center justify-end gap-2"}>
                {terminalRecordCount > 0 ? (<Button type="button" variant="outline" size="sm" title={t("groups.membershipEvidence.clearTerminalDetail")} onClick={handleOpenClearTerminal} className="h-9 gap-1.5 rounded-xl border-rose-500/30 px-3 text-[10px] font-black uppercase tracking-widest text-rose-700 hover:bg-rose-500/10 dark:border-rose-500/35 dark:text-rose-300 dark:hover:bg-rose-500/15">
                        <Trash2 className="h-3.5 w-3.5"/>
                        {t("groups.membershipEvidence.clearTerminal")}
                    </Button>) : null}
                <Button type="button" variant="outline" size="sm" title={t("groups.membershipEvidence.reconcileDetail")} onClick={handleReconcile} className="h-9 gap-1.5 rounded-xl border-black/10 px-3 text-[10px] font-black uppercase tracking-widest text-zinc-700 hover:bg-black/[0.04] dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/5">
                    <RefreshCw className="h-3.5 w-3.5"/>
                    {t("groups.membershipEvidence.reconcile")}
                </Button>
            </div>
            <ConfirmDialog isOpen={isClearTerminalOpen} onClose={() => setIsClearTerminalOpen(false)} onConfirm={handleConfirmClearTerminal} title={t("groups.membershipEvidence.clearTerminalTitle")} description={t("groups.membershipEvidence.clearTerminalConfirm")} confirmLabel={t("groups.membershipEvidence.clearTerminalConfirmAction")} variant="danger"/>
        </>);
};
