"use client";

import React from "react";
import { useTranslation } from "react-i18next";
import { Database, Radio } from "lucide-react";
import { cn } from "@/app/lib/cn";
import { isWorkspaceR1MembershipEnforced } from "@/app/features/groups/services/community-dev-flags";
import {
    getCoordinationBaseUrl,
    isCoordinationConfigured,
    readMembershipSyncMode,
    writeMembershipSyncMode,
    type MembershipSyncMode,
} from "@/app/features/groups/services/community-membership-sync-mode";
import { getCoordinationUrlSource } from "@/app/features/groups/services/operator-trust-config";

export function CommunityMembershipSyncSettingsPanel(): React.JSX.Element {
    const { t } = useTranslation();
    const coordinationConfigured = isCoordinationConfigured();
    const coordinationUrl = getCoordinationBaseUrl();
    const coordinationSource = getCoordinationUrlSource();
    const r1Locked = coordinationConfigured && isWorkspaceR1MembershipEnforced();
    const [mode, setMode] = React.useState<MembershipSyncMode>(() => readMembershipSyncMode());

    React.useEffect(() => {
        if (coordinationConfigured && isWorkspaceR1MembershipEnforced()) {
            writeMembershipSyncMode("coordination_preferred");
            setMode("coordination_preferred");
        }
    }, [coordinationConfigured]);

    const selectMode = (next: MembershipSyncMode): void => {
        if (next === "coordination_preferred" && !coordinationConfigured) {
            return;
        }
        if (r1Locked && next === "nostr_only") {
            return;
        }
        writeMembershipSyncMode(next);
        setMode(next);
    };

    return (
        <div
            id="membership-sync-settings"
            className="space-y-4 rounded-2xl border border-black/5 p-5 dark:border-white/5 bg-white dark:bg-black/20"
            data-testid="membership-sync-settings-panel"
        >
            <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-zinc-500">
                    <Database className="h-4 w-4 text-sky-500" />
                    {t("settings.membershipSync.title", "Community membership sync")}
                </div>
                <p className="text-xs text-zinc-500 leading-relaxed">
                    {r1Locked
                        ? t(
                            "settings.membershipSync.descR1",
                            "Workspace communities (R1) always use the coordination directory for join/leave. Nostr relays carry encrypted chat only—not roster authority.",
                        )
                        : t(
                            "settings.membershipSync.desc",
                            "Controls how leave/join evidence is merged for community rosters. Relay lines are hints on public relays; coordination is optional but recommended when available.",
                        )}
                </p>
            </div>

            {r1Locked ? (
                <p
                    className="rounded-lg border border-sky-500/25 bg-sky-500/10 px-3 py-2 text-xs text-sky-900 dark:text-sky-100"
                    data-testid="membership-sync-r1-locked"
                >
                    {t(
                        "settings.membershipSync.r1Locked",
                        "Coordination preferred is required for new workspace communities. Sovereign rooms on public relays remain a legacy read path only.",
                    )}
                </p>
            ) : null}

            <div className="grid gap-2 sm:grid-cols-2">
                <button
                    type="button"
                    data-testid="membership-sync-nostr-only"
                    aria-pressed={mode === "nostr_only"}
                    disabled={r1Locked}
                    onClick={() => selectMode("nostr_only")}
                    className={cn(
                        "rounded-xl border p-3 text-left transition-colors",
                        r1Locked && "cursor-not-allowed opacity-50",
                        mode === "nostr_only"
                            ? "border-primary/40 bg-primary/5"
                            : "border-zinc-200 dark:border-zinc-800 hover:border-primary/20",
                    )}
                >
                    <div className="flex items-center gap-2">
                        <Radio className="h-4 w-4 text-primary shrink-0" />
                        <span className="text-sm font-semibold text-zinc-900 dark:text-white">
                            {t("settings.membershipSync.nostrOnly", "Nostr only")}
                        </span>
                    </div>
                    <p className="mt-1 text-[11px] text-zinc-500">
                        {t(
                            "settings.membershipSync.nostrOnlyHint",
                            "Relay-backed roster hints only. No coordination directory polling.",
                        )}
                    </p>
                </button>

                <button
                    type="button"
                    data-testid="membership-sync-coordination"
                    aria-pressed={mode === "coordination_preferred"}
                    disabled={!coordinationConfigured}
                    onClick={() => selectMode("coordination_preferred")}
                    className={cn(
                        "rounded-xl border p-3 text-left transition-colors",
                        !coordinationConfigured && "cursor-not-allowed opacity-60",
                        mode === "coordination_preferred"
                            ? "border-sky-500/40 bg-sky-500/5"
                            : "border-zinc-200 dark:border-zinc-800 hover:border-sky-500/20",
                    )}
                >
                    <div className="flex items-center gap-2">
                        <Database className="h-4 w-4 text-sky-500 shrink-0" />
                        <span className="text-sm font-semibold text-zinc-900 dark:text-white">
                            {t("settings.membershipSync.coordinationPreferred", "Coordination preferred")}
                        </span>
                    </div>
                    <p className="mt-1 text-[11px] text-zinc-500">
                        {coordinationConfigured
                            ? t(
                                "settings.membershipSync.coordinationPreferredHint",
                                "Poll the Obscur coordination membership directory when online.",
                            )
                            : t(
                                "settings.membershipSync.coordinationUnavailable",
                                "Set NEXT_PUBLIC_COORDINATION_URL at build time to enable this mode.",
                            )}
                    </p>
                </button>
            </div>

            {coordinationUrl ? (
                <p className="text-[10px] font-mono text-zinc-500 truncate" data-testid="coordination-url-display">
                    {t("settings.membershipSync.coordinationEndpoint", "Coordination endpoint")}: {coordinationUrl}
                    {coordinationSource === "runtime_override" ? (
                        <span className="ml-1 text-emerald-700 dark:text-emerald-300">
                            ({t("settings.membershipSync.runtimeOverride", "device override")})
                        </span>
                    ) : null}
                </p>
            ) : (
                <p className="text-[11px] text-amber-800/90 dark:text-amber-200/90 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                    {t(
                        "settings.membershipSync.coordinationBuildHint",
                        "Set coordination in Operator setup above, or NEXT_PUBLIC_COORDINATION_URL at build time. Until configured, Nostr only is the supported path.",
                    )}
                </p>
            )}
            <p className="text-[10px] text-zinc-500">
                {t("settings.membershipSync.locationHint", "Location: Settings → Relays tab (this panel).")}
            </p>
        </div>
    );
}
