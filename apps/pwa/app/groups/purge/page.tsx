"use client";

import React, { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { Button, Card } from "@dweb/ui-kit";
import { PageShell } from "@/app/components/page-shell";
import { useGroups } from "@/app/features/groups/providers/group-provider";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { useRelay } from "@/app/features/relays/providers/relay-provider";
import { useSealedCommunity, toScopedRelayUrl } from "@/app/features/groups/hooks/use-sealed-community";
import { getResolvedClientGateway } from "@/app/features/profiles/services/resolve-client-gateway";
import { toGroupConversationId } from "@/app/features/groups/utils/group-conversation-id";
import { resolveGroupConversationByToken } from "@/app/features/messaging/utils/conversation-target";
import { resolveGroupRouteToken } from "@/app/features/groups/utils/group-route-token";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { buildGroupViewHref } from "@/app/features/groups/utils/group-action-route";
import { toast } from "@dweb/ui-kit";

export default function PurgeCommunityPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const {
        createdGroups,
        leaveGroup,
        forcePurgeCommunity,
        communityKnownParticipantDirectoryByConversationId,
        communityRosterByConversationId,
    } = useGroups();
    const { state: identityState } = useIdentity();
    const { relayPool } = useRelay();
    const [isPurging, setIsPurging] = useState(false);

    const routeToken = resolveGroupRouteToken({
        routeParam: undefined,
        queryId: searchParams.get("id"),
    });
    const queryRelay = searchParams.get("relay");
    const queryName = searchParams.get("name")?.trim() ?? "";
    const queryCommunityId = searchParams.get("communityId")?.trim() ?? "";

    const group = routeToken ? (resolveGroupConversationByToken(createdGroups, routeToken) ?? undefined) : undefined;
    const localMemberPubkey = (identityState.publicKeyHex || identityState.stored?.publicKeyHex || null) as PublicKeyHex | null;

    const effectiveRelay = toScopedRelayUrl(group?.relayUrl || queryRelay || "") ?? "";
    const resolvedGroupId = useMemo(() => {
        const metadataGroupId = group?.groupId?.trim() ?? "";
        if (metadataGroupId.length > 0) {
            return metadataGroupId;
        }
        return routeToken ?? "";
    }, [group?.groupId, routeToken]);
    const displayName = group?.displayName || queryName || "Community";

    const resolvedCommunityIdForScope = useMemo(() => {
        const raw = (group?.communityId || queryCommunityId)?.trim();
        return raw && raw.length > 0 ? raw : undefined;
    }, [group?.communityId, queryCommunityId]);

    const rosterLookupConversationId = useMemo((): string | null => {
        if (group?.id) {
            return group.id;
        }
        const gid = resolvedGroupId.trim();
        const relay = effectiveRelay.trim();
        if (!gid || !relay) {
            return null;
        }
        return toGroupConversationId({
            groupId: gid,
            relayUrl: relay,
            ...(resolvedCommunityIdForScope ? { communityId: resolvedCommunityIdForScope } : {}),
        });
    }, [effectiveRelay, group?.id, resolvedCommunityIdForScope, resolvedGroupId]);

    const purgeSealedCommunityInitialMembers = useMemo((): ReadonlyArray<PublicKeyHex> | undefined => {
        if (!rosterLookupConversationId) {
            return getResolvedClientGateway().communityRoster.resolveSeedMemberPubkeysFromDirectory({
                directory: null,
                persistedGroupMemberPubkeys: group?.memberPubkeys,
                projectionMemberPubkeys: undefined,
                localMemberPubkey: localMemberPubkey,
            });
        }
        return getResolvedClientGateway().communityRoster.resolveSeedMemberPubkeysFromDirectory({
            directory: communityKnownParticipantDirectoryByConversationId[rosterLookupConversationId] ?? null,
            persistedGroupMemberPubkeys: group?.memberPubkeys,
            projectionMemberPubkeys: communityRosterByConversationId[rosterLookupConversationId]?.activeMemberPubkeys,
            localMemberPubkey: localMemberPubkey,
        });
    }, [
        communityKnownParticipantDirectoryByConversationId,
        communityRosterByConversationId,
        group?.memberPubkeys,
        localMemberPubkey,
        rosterLookupConversationId,
    ]);

    const { leaveGroup: leaveNip29Group } = useSealedCommunity({
        groupId: resolvedGroupId,
        relayUrl: effectiveRelay,
        ...(group?.communityId || queryCommunityId ? { communityId: group?.communityId || queryCommunityId } : {}),
        pool: relayPool,
        myPublicKeyHex: localMemberPubkey,
        myPrivateKeyHex: identityState.privateKeyHex ?? null,
        initialMembers: purgeSealedCommunityInitialMembers,
    });

    const returnHref = useMemo(() => buildGroupViewHref({
        routeToken: routeToken || group?.id || resolvedGroupId,
        relayUrl: effectiveRelay || undefined,
        displayName,
        communityId: resolvedCommunityIdForScope,
    }), [displayName, effectiveRelay, group?.id, resolvedCommunityIdForScope, resolvedGroupId, routeToken]);

    const handlePurge = async () => {
        if (!resolvedGroupId || !effectiveRelay) {
            toast.error("Community details are missing; unable to purge safely.");
            return;
        }

        setIsPurging(true);
        try {
            if (group) {
                leaveGroup({
                    groupId: group.groupId,
                    relayUrl: group.relayUrl,
                    conversationId: group.id,
                });
            } else {
                leaveGroup({
                    groupId: resolvedGroupId,
                    relayUrl: effectiveRelay,
                });
            }
            await leaveNip29Group();
            forcePurgeCommunity({
                groupId: resolvedGroupId,
                relayUrl: effectiveRelay,
                conversationId: group?.id,
            });
            toast.success("Community purged");
            router.push("/network");
        } catch {
            toast.error("Failed to purge community");
        } finally {
            setIsPurging(false);
        }
    };

    return (
        <PageShell title="Purge Community">
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
                                    Irreversible purge
                                </div>
                                <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">
                                    Purge {displayName}
                                </h1>
                                <p className="max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                                    Remove all local traces of this community on this device, including membership ledger entries and chat state. This does not delete relay data for other participants.
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
                                <li>You will leave relay scope <span className="font-bold text-zinc-900 dark:text-zinc-100">{effectiveRelay || "unknown"}</span> and clear local room keys.</li>
                                <li>Local membership ledger entries for this community will be removed.</li>
                                <li>A tombstone prevents this community from reappearing until you join again intentionally.</li>
                            </ul>
                        </div>

                        <div className="rounded-[28px] border border-rose-200 bg-[linear-gradient(180deg,#fff1f2_0%,#ffe4e6_100%)] p-6 dark:border-rose-500/25 dark:bg-[linear-gradient(180deg,rgba(190,24,93,0.18)_0%,rgba(88,28,28,0.35)_100%)]">
                            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-rose-600 dark:text-rose-400">
                                Confirm purge
                            </div>
                            <div className="mt-4 text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">
                                If you are sure, continue below. This is intentionally isolated from the community page so nothing competes with the confirmation step.
                            </div>
                            <div className="mt-8 flex flex-col gap-3">
                                <Button
                                    variant="secondary"
                                    className="h-12 rounded-2xl border border-white/20 bg-violet-600 text-white hover:bg-violet-700 dark:border-white/10 dark:bg-[#1b1d2a] dark:hover:bg-[#26293b]"
                                    onClick={() => router.push(returnHref)}
                                    disabled={isPurging}
                                >
                                    Stay in Community
                                </Button>
                                <Button
                                    variant="danger"
                                    className="h-12 rounded-2xl gap-2 text-sm font-black"
                                    onClick={handlePurge}
                                    disabled={isPurging}
                                >
                                    {isPurging ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                    Purge Community
                                </Button>
                            </div>
                        </div>
                    </div>
                </Card>
            </div>
        </PageShell>
    );
}
