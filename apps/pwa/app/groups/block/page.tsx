"use client";

import React, { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, Ban, Loader2 } from "lucide-react";
import { Button, Card } from "@dweb/ui-kit";
import { PageShell } from "@/app/components/page-shell";
import { useGroups } from "@/app/features/groups/providers/group-provider-port";
import { useNetwork } from "@/app/features/network/providers/network-provider";
import { resolveGroupConversationByToken } from "@/app/features/messaging/utils/conversation-target";
import { resolveGroupRouteToken } from "@/app/features/groups/utils/group-route-token";
import { buildGroupViewHref } from "@/app/features/groups/utils/group-action-route";
import { toast } from "@dweb/ui-kit";

export default function BlockCommunityPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { createdGroups } = useGroups();
    const { blocklist } = useNetwork();
    const [isBlocking, setIsBlocking] = useState(false);

    const routeToken = resolveGroupRouteToken({
        routeParam: undefined,
        queryId: searchParams.get("id"),
    });
    const queryRelay = searchParams.get("relay");
    const queryName = searchParams.get("name")?.trim() ?? "";
    const group = routeToken ? (resolveGroupConversationByToken(createdGroups, routeToken) ?? undefined) : undefined;
    const displayName = group?.displayName || queryName || "Community";
    const returnHref = useMemo(() => buildGroupViewHref({
        routeToken: routeToken || group?.id || "",
        relayUrl: group?.relayUrl || queryRelay || undefined,
        displayName,
        communityId: group?.communityId,
    }), [displayName, group?.communityId, group?.id, group?.relayUrl, queryRelay, routeToken]);

    const handleBlock = async () => {
        const blockIdentifier = (group?.groupId || routeToken || "").trim();
        if (!blockIdentifier) {
            toast.error("Community details are missing; unable to block safely.");
            return;
        }
        setIsBlocking(true);
        try {
            blocklist.addBlocked({ publicKeyInput: blockIdentifier });
            toast.success("Community blocked");
            router.push(returnHref);
        } catch {
            toast.error("Failed to block community");
        } finally {
            setIsBlocking(false);
        }
    };

    return (
        <PageShell title="Block Community">
            <div className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-3xl items-center justify-center px-4 py-10">
                <Card className="w-full rounded-[32px] border-zinc-200/50 bg-white p-0 shadow-2xl dark:border-white/10 dark:bg-[#0b0b10] dark:shadow-[0_30px_120px_rgba(0,0,0,0.45)]">
                    <div className="border-b border-zinc-200/50 px-8 py-7 dark:border-white/8">
                        <button
                            type="button"
                            onClick={() => router.push(returnHref)}
                            className="mb-6 inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500 transition-colors hover:text-zinc-700 dark:hover:text-zinc-200"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Back to Community
                        </button>
                        <div className="flex items-start gap-5">
                            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl border border-rose-500/20 bg-rose-500/10 text-rose-400">
                                <AlertTriangle className="h-8 w-8" />
                            </div>
                            <div className="space-y-2">
                                <div className="text-[11px] font-black uppercase tracking-[0.2em] text-rose-400/80">
                                    Local block
                                </div>
                                <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">
                                    Block {displayName}
                                </h1>
                                <p className="max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                                    Hide this community on this device and stop processing its events locally. This does not delete anything on relays or other Nostr clients.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-6 px-8 py-8 md:grid-cols-[1.2fr_0.8fr]">
                        <div className="rounded-[28px] border border-zinc-200 bg-[#fafafa] p-6 dark:border-white/8 dark:bg-[#141521]">
                            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
                                What happens next
                            </div>
                            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                                <li>This community will be hidden from your network lists on this device.</li>
                                <li>Incoming community events from this scope will be ignored locally.</li>
                                <li>You can unblock later from the same community page.</li>
                            </ul>
                        </div>

                        <div className="rounded-[28px] border border-rose-200 bg-[linear-gradient(180deg,#fff1f2_0%,#ffe4e6_100%)] p-6 dark:border-rose-500/25 dark:bg-[linear-gradient(180deg,rgba(190,24,93,0.18)_0%,rgba(88,28,28,0.35)_100%)]">
                            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-rose-600 dark:text-rose-400">
                                Confirm block
                            </div>
                            <div className="mt-4 text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">
                                If you are sure, continue below. This is intentionally isolated from the community page so nothing competes with the confirmation step.
                            </div>
                            <div className="mt-8 flex flex-col gap-3">
                                <Button
                                    variant="secondary"
                                    className="h-12 rounded-2xl border border-white/20 bg-violet-600 text-white hover:bg-violet-700 dark:border-white/10 dark:bg-[#1b1d2a] dark:hover:bg-[#26293b]"
                                    onClick={() => router.push(returnHref)}
                                    disabled={isBlocking}
                                >
                                    Stay in Community
                                </Button>
                                <Button
                                    variant="danger"
                                    className="h-12 rounded-2xl gap-2 text-sm font-black"
                                    onClick={handleBlock}
                                    disabled={isBlocking}
                                >
                                    {isBlocking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
                                    Block Community
                                </Button>
                            </div>
                        </div>
                    </div>
                </Card>
            </div>
        </PageShell>
    );
}
