"use client";

import React from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@dweb/ui-kit";
import type { CommunityMemberEvidenceTier } from "../utils/community-member-evidence-tier";

export const CommunityMembershipEvidenceChip: React.FC<
    Readonly<{
        tier: CommunityMemberEvidenceTier;
        className?: string;
    }>
> = ({ tier, className }) => {
    const { t } = useTranslation();
    const isProvisional = tier === "provisional";
    const isTerminal = tier === "terminal";
    const label = isTerminal
        ? t("groups.membershipEvidence.terminal", "Terminal")
        : isProvisional
            ? t("groups.membershipEvidence.provisional", "Provisional")
            : t("groups.membershipEvidence.relayConfirmed", "Relay-confirmed");
    const title = isTerminal
        ? t(
            "groups.membershipEvidence.terminalHint",
            "Excluded from the active roster by leave or expulsion evidence (local cache and/or relay).",
        )
        : isProvisional
            ? t(
                "groups.membershipEvidence.provisionalHint",
                "Shown from local chat/invite evidence until the relay roster catches up.",
            )
            : t(
                "groups.membershipEvidence.relayConfirmedHint",
                "Present in relay-backed membership evidence for this community.",
            );

    return (
        <span
            data-testid="membership-evidence-chip"
            data-tier={tier}
            title={title}
            className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-widest",
                isTerminal
                    ? "bg-zinc-500/25 text-zinc-700 dark:text-zinc-300"
                    : isProvisional
                        ? "bg-amber-500/20 text-amber-800 dark:text-amber-200"
                        : "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
                className,
            )}
        >
            {label}
        </span>
    );
};
