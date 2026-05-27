"use client";

import React from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@dweb/ui-kit";
import type { CommunityMemberEvidenceTier } from "../utils/community-member-evidence-tier";
import {
    resolveMembershipEvidenceChipPresentation,
    type MembershipEvidenceUiContext,
} from "../utils/community-membership-evidence-display";
import { readMembershipSyncMode } from "../services/community-membership-sync-mode";

export const CommunityMembershipEvidenceChip: React.FC<
    Readonly<{
        tier: CommunityMemberEvidenceTier;
        uiContext?: MembershipEvidenceUiContext;
        className?: string;
    }>
> = ({ tier, uiContext, className }) => {
    const { t } = useTranslation();
    const context = uiContext ?? { membershipSyncMode: readMembershipSyncMode() };
    const presentation = resolveMembershipEvidenceChipPresentation(tier, context);
    const label = t(presentation.labelKey, presentation.labelDefault);
    const title = t(presentation.hintKey, presentation.hintDefault);

    return (
        <span
            data-testid="membership-evidence-chip"
            data-tier={tier}
            data-display-variant={presentation.variant}
            title={title}
            className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-widest",
                presentation.variant === "terminal"
                    ? "bg-zinc-500/25 text-zinc-700 dark:text-zinc-300"
                    : presentation.variant === "provisional"
                        ? "bg-amber-500/20 text-amber-800 dark:text-amber-200"
                        : presentation.variant === "directory_sync"
                            ? "bg-sky-500/15 text-sky-800 dark:text-sky-200"
                            : "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
                className,
            )}
        >
            {label}
        </span>
    );
};
