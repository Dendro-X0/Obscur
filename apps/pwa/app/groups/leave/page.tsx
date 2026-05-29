"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, LogOut, Trash2 } from "lucide-react";
import { CommunityActionWaitRing } from "@/app/features/groups/components/community-action-wait-ring";
import {
    buildCommunityActionWaitSteps,
    type CommunityActionWaitStep,
} from "@/app/features/groups/components/community-action-wait-types";
import { isCoordinationConfigured, readMembershipSyncMode } from "@/app/features/groups/services/community-membership-sync-mode";
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
import { toast } from "@dweb/ui-kit";
import { hasWritableCommunityRelayTransport } from "@/app/features/groups/services/community-relay-transport";
import {
    CommunityNetworkTimeoutError,
    withCommunityNetworkTimeout,
} from "@/app/features/groups/services/community-network-timeout";
import { ProfileRegistryService } from "@/app/features/profiles/services/profile-registry-service";

export default function LeaveCommunityPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const deleteActionsRef = useRef<HTMLDivElement | null>(null);
    const {
        createdGroups,
        leaveGroup,
        forcePurgeCommunity,
        communityKnownParticipantDirectoryByConversationId,
        communityRosterByConversationId,
    } = useGroups();
    const { state: identityState } = useIdentity();
    const { relayPool } = useRelay();
    const [isLeaving, setIsLeaving] = useState(false);
    const [leaveWaitPhase, setLeaveWaitPhase] = useState<string | null>(null);
    const [leaveWaitComplete, setLeaveWaitComplete] = useState(false);
    const [isPurgingLocal, setIsPurgingLocal] = useState(false);

    const routeToken = resolveGroupRouteToken({
        routeParam: undefined,
        queryId: searchParams.get("id"),
    });
    const queryRelay = searchParams.get("relay");
    const queryName = searchParams.get("name")?.trim() ?? "";
    const queryCommunityId = searchParams.get("communityId")?.trim() ?? "";
    const isDeleteFlow = searchParams.get("action") === "delete";

    const group = routeToken ? (resolveGroupConversationByToken(createdGroups, routeToken) ?? undefined) : undefined;
    const localMemberPubkey = (identityState.publicKeyHex || identityState.stored?.publicKeyHex || null) as PublicKeyHex | null;

    const effectiveRelay = toScopedRelayUrl(group?.relayUrl || queryRelay || "") ?? (group?.relayUrl || queryRelay || "");
    const relayTransportReady = hasWritableCommunityRelayTransport(effectiveRelay);

    const leaveStepDefs = useMemo(
        () => [
            {
                id: "local",
                label: "Local exit",
                detail: "Remove room key and participation on this device.",
            },
            {
                id: "relay",
                label: "Relay proof",
                detail: relayTransportReady
                    ? "Publish leave to community relays when reachable."
                    : "Skipped — no writable relay on this host.",
            },
            {
                id: "directory",
                label: "Directory",
                detail: isCoordinationConfigured() && readMembershipSyncMode() === "coordination_preferred"
                    ? "Notify coordination membership directory."
                    : "Optional — coordination not configured.",
            },
        ],
        [relayTransportReady],
    );

    const leaveWaitSteps: ReadonlyArray<CommunityActionWaitStep> = useMemo(
        () => buildCommunityActionWaitSteps(leaveStepDefs, leaveWaitPhase, {
            allComplete: leaveWaitComplete,
            skippedStepIds: [
                ...(relayTransportReady ? [] : ["relay"]),
                ...(isCoordinationConfigured() && readMembershipSyncMode() === "coordination_preferred"
                    ? []
                    : ["directory"]),
            ],
        }),
        [leaveStepDefs, leaveWaitComplete, leaveWaitPhase, relayTransportReady],
    );

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

    const leaveSealedCommunityInitialMembers = useMemo((): ReadonlyArray<PublicKeyHex> | undefined => {
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
        initialMembers: leaveSealedCommunityInitialMembers,
        enabled: relayTransportReady,
    });

    const returnHref = useMemo(() => {
        const params = new URLSearchParams();
        if (routeToken) {
            params.set("id", routeToken);
        }
        if (effectiveRelay) {
            params.set("relay", effectiveRelay);
        }
        return params.toString().length > 0 ? `/groups/view?${params.toString()}` : "/network";
    }, [effectiveRelay, routeToken]);

    const activeProfileLabel = useMemo(() => {
        try {
            const registry = ProfileRegistryService.getState();
            return registry.profiles.find((profile) => profile.profileId === registry.activeProfileId)?.label
                ?? "this profile";
        } catch {
            return "this profile";
        }
    }, []);

    useEffect(() => {
        if (!isDeleteFlow || isLeaving || isPurgingLocal) {
            return;
        }
        deleteActionsRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, [isDeleteFlow, isLeaving, isPurgingLocal]);

    const applyLocalLeave = (): void => {
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
    };

    const handleLeave = async () => {
        if (!resolvedGroupId || !effectiveRelay) {
            toast.error("Community details are missing; unable to leave safely.");
            return;
        }

        setIsLeaving(true);
        setLeaveWaitComplete(false);
        setLeaveWaitPhase("local");
        try {
            applyLocalLeave();
            setLeaveWaitPhase("relay");

            if (relayTransportReady && identityState.privateKeyHex) {
                try {
                    await withCommunityNetworkTimeout(leaveNip29Group());
                } catch (error) {
                    if (error instanceof CommunityNetworkTimeoutError) {
                        toast.warning(
                            "Left on this device. Relay confirmation timed out and will retry in the background.",
                        );
                    } else {
                        toast.warning(
                            "Left on this device. Relay confirmation may finish in the background.",
                        );
                    }
                }
            } else {
                toast.success(
                    "Removed this community on this device. Network relay was unavailable or not a real wss:// host.",
                );
            }

            setLeaveWaitPhase("directory");
            setLeaveWaitComplete(true);
            await new Promise((resolve) => setTimeout(resolve, 450));
            router.push("/network");
        } catch {
            toast.error("Failed to leave community");
            router.push("/network");
        } finally {
            setIsLeaving(false);
            setLeaveWaitPhase(null);
            setLeaveWaitComplete(false);
        }
    };

    const handleDeleteLocal = async () => {
        if (!resolvedGroupId || !effectiveRelay) {
            toast.error("Community details are missing; unable to purge.");
            return;
        }
        setIsPurgingLocal(true);
        try {
            applyLocalLeave();
            forcePurgeCommunity({
                groupId: resolvedGroupId,
                relayUrl: effectiveRelay,
                conversationId: group?.id,
            });
            toast.success("Community removed from this device");
            router.push("/network");
        } catch {
            toast.error("Failed to remove community data");
        } finally {
            setIsPurgingLocal(false);
        }
    };

    const pageTitle = isDeleteFlow ? "Delete Community" : "Leave Community";
    const headerEyebrow = isDeleteFlow ? "Delete Community" : "Exit Community";
    const headerTitle = isDeleteFlow ? `Delete ${displayName}` : `Leave ${displayName}`;
    const headerDescription = isDeleteFlow
        ? `This permanently removes local chat, membership, and ledger data for ${displayName} on ${activeProfileLabel}. Your account stays on this device. This cannot be undone here.`
        : "This action will disconnect you from this community space. You will stop receiving future messages, roster updates, and shared room-key changes unless you are invited back later.";
    const confirmPanelTitle = isDeleteFlow ? "Confirm delete" : "Confirm Exit";
    const confirmPanelDescription = isDeleteFlow
        ? "Review the details below, then delete all local data when you are ready. Local removal happens first so the UI cannot hang on unreachable relays."
        : "If you are sure, continue below. Local removal happens first so the UI cannot hang on unreachable relays.";
    const isBusy = isLeaving || isPurgingLocal;

    return (
        <PageShell title={pageTitle}>
            <div className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-3xl items-center justify-center px-4 py-10">
                <Card className="w-full rounded-[32px] border-zinc-200/50 bg-white p-0 shadow-2xl dark:border-white/10 dark:bg-[#0b0b10] dark:shadow-[0_30px_120px_rgba(0,0,0,0.45)]">
                    <div className="border-b border-zinc-200/50 px-8 py-7 dark:border-white/8">
                        <button
                            type="button"
                            onClick={() => router.push(returnHref)}
                            disabled={isBusy}
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
                                    {headerEyebrow}
                                </div>
                                <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">
                                    {headerTitle}
                                </h1>
                                <p className="max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                                    {headerDescription}
                                </p>
                            </div>
                        </div>
                    </div>

                    {isLeaving ? (
                        <div className="px-8 py-10">
                            <CommunityActionWaitRing
                                title={`Leaving ${displayName}`}
                                subtitle="Local removal runs first; relay and directory steps continue in the background when the network allows."
                                steps={leaveWaitSteps}
                            />
                        </div>
                    ) : (
                    <div className="grid gap-6 px-8 py-8 md:grid-cols-[1.2fr_0.8fr]">
                        <div className="rounded-[28px] border border-zinc-200 bg-[#fafafa] p-6 dark:border-white/8 dark:bg-[#141521]">
                            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
                                What happens next
                            </div>
                            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                                {isDeleteFlow ? (
                                    <>
                                        <li>All local chat history, membership evidence, and ledger entries for <span className="font-bold text-zinc-900 dark:text-zinc-100">{displayName}</span> will be removed on {activeProfileLabel}.</li>
                                        <li>The community disappears from your Network list on this device.</li>
                                        <li>You can rejoin later only if someone sends you a fresh invite.</li>
                                    </>
                                ) : (
                                    <>
                                        <li>You will leave the current community instance on relay scope <span className="font-bold text-zinc-900 dark:text-zinc-100">{effectiveRelay || "unknown"}</span>.</li>
                                        <li>Your local room key and active participation state will be cleared for this community.</li>
                                        <li>You can still return later if you receive a fresh invite or the community is shared with you again.</li>
                                    </>
                                )}
                            </ul>
                            {!relayTransportReady && !isDeleteFlow ? (
                                <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-950 dark:text-amber-100">
                                    This host is not a reachable Nostr relay. Exit will complete on this device only (no global relay fanout).
                                </p>
                            ) : null}
                        </div>

                        <div
                            ref={deleteActionsRef}
                            className="rounded-[28px] border border-rose-200 bg-[linear-gradient(180deg,#fff1f2_0%,#ffe4e6_100%)] p-6 dark:border-rose-500/25 dark:bg-[linear-gradient(180deg,rgba(190,24,93,0.18)_0%,rgba(88,28,28,0.35)_100%)]"
                        >
                            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-rose-600 dark:text-rose-400">
                                {confirmPanelTitle}
                            </div>
                            <div className="mt-4 text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">
                                {confirmPanelDescription}
                            </div>
                            <div className="mt-8 flex flex-col gap-3">
                                <Button
                                    variant="secondary"
                                    className="h-12 rounded-2xl border border-white/20 bg-violet-600 text-white hover:bg-violet-700 dark:border-white/10 dark:bg-[#1b1d2a] dark:hover:bg-[#26293b]"
                                    onClick={() => router.push(returnHref)}
                                    disabled={isBusy}
                                >
                                    Stay in Community
                                </Button>
                                {isDeleteFlow ? (
                                    <>
                                        <Button
                                            variant="danger"
                                            className="h-12 rounded-2xl gap-2 text-sm font-black"
                                            onClick={() => void handleDeleteLocal()}
                                            disabled={isBusy}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                            Delete all local data
                                        </Button>
                                        <Button
                                            variant="secondary"
                                            className="h-12 rounded-2xl gap-2 border border-rose-300/40 text-sm font-bold text-rose-700 dark:text-rose-200"
                                            onClick={() => void handleLeave()}
                                            disabled={isBusy}
                                        >
                                            <LogOut className="h-4 w-4" />
                                            Leave without full purge
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <Button
                                            variant="danger"
                                            className="h-12 rounded-2xl gap-2 text-sm font-black"
                                            onClick={() => void handleLeave()}
                                            disabled={isBusy}
                                        >
                                            <LogOut className="h-4 w-4" />
                                            Leave Community
                                        </Button>
                                        <Button
                                            variant="secondary"
                                            className="h-12 rounded-2xl gap-2 border border-rose-300/40 text-sm font-bold text-rose-700 dark:text-rose-200"
                                            onClick={() => void handleDeleteLocal()}
                                            disabled={isBusy}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                            Delete all local data
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                    )}
                </Card>
            </div>
        </PageShell>
    );
};
