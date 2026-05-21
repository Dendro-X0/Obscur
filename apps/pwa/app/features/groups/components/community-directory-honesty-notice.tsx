"use client";

import React from "react";
import { cn } from "@/app/lib/cn";
import type { CommunityDirectoryMaterializationHonesty } from "../services/community-directory-materialization-policy";

export function CommunityDirectoryHonestyNotice({
    honesty,
    className,
    compact = false,
}: Readonly<{
    honesty: CommunityDirectoryMaterializationHonesty;
    className?: string;
    compact?: boolean;
}>): React.JSX.Element | null {
    if (honesty.claimsAuthoritativeDirectory) {
        return null;
    }

    if (compact) {
        return (
            <p
                className={cn(
                    "rounded-lg border border-zinc-700 bg-zinc-900/50 px-3 py-2 text-xs text-zinc-400",
                    className,
                )}
                role="status"
            >
                <span className="font-medium text-zinc-300">{honesty.summary}.</span>
                {" "}
                {honesty.detail}
            </p>
        );
    }

    return (
        <div
            className={cn(
                "rounded-2xl border border-sky-500/25 bg-sky-500/10 px-4 py-3 text-sm text-sky-100",
                className,
            )}
            role="status"
        >
            <p className="font-semibold text-sky-50">{honesty.summary}</p>
            <p className="mt-1 text-xs text-sky-100/90">{honesty.detail}</p>
        </div>
    );
}
