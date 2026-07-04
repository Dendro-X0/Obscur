"use client";

import { useLegacySealedCommunity } from "@/app/features/groups/hooks/sealed-community-port";
import { Button } from "@dweb/ui-kit";
import { Avatar, AvatarImage, AvatarFallback } from "@dweb/ui-kit";
import { Users, ShieldCheck, X } from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRelay } from "../../relays/providers/relay-provider";
import { useRelayPoolRef } from "../../relays/hooks/use-relay-pool-ref";
import { useIdentity } from "../../auth/hooks/use-identity";
import { useGroups } from "@/app/features/groups/providers/group-provider-port";
import { toGroupConversationId } from "../utils/group-conversation-id";
import { deriveCommunityId } from "../utils/community-identity";
import { resolveManagedWorkspaceCommunityId } from "@/app/features/workspace-kernel/workspace-kernel-membership-scope";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { dispatchGroupInviteReceived } from "@/app/features/profiles/services/profile-bus-dispatch";
import {
    assertWorkspaceCommunityJoinAllowed,
    useWorkspaceCommunityTrustGate,
} from "../hooks/use-workspace-community-trust-gate";
import { ensureWorkspaceMembershipSyncMode } from "../services/community-workspace-membership";
import { isWorkspaceKernelAuthority } from "@/app/features/workspace-kernel/workspace-kernel-policy";
import { joinManagedWorkspaceMembership } from "@/app/features/workspace-kernel/workspace-kernel-membership-port";
import { useRelayList } from "../../relays/hooks/use-relay-list";
import type { GroupConversation } from "@/app/features/messaging/types";

/**
 * Props for GroupJoinDialog
 */
export type GroupJoinDialogProps = Readonly<{
    open: boolean;
    onOpenChange: (open: boolean) => void;
    groupId: string;
    relayUrl: string;
    onSuccess?: () => void;
}>;

/**
 * Dialog to show group information before joining
 */
export const GroupJoinDialog = ({ open, onOpenChange, groupId, relayUrl, onSuccess }: GroupJoinDialogProps) => {
    const router = useRouter();
    const { relayPool: pool } = useRelay();
    const poolRef = useRelayPoolRef(pool);
    const { state: identityState } = useIdentity();
    const { addGroup } = useGroups();
    const relayList = useRelayList({ publicKeyHex: identityState.publicKeyHex || null });
    const workspaceKernelJoin = isWorkspaceKernelAuthority();
    const { trust: workspaceTrust, blocked: workspaceJoinBlocked } = useWorkspaceCommunityTrustGate({
        communityRelayUrl: relayUrl,
        active: open,
    });

    // Ensure the group's relay is connected as a transient relay
    useEffect(() => {
        if (open && relayUrl) {
            poolRef.current.addTransientRelay(relayUrl);
        }
    }, [open, relayUrl, poolRef]);

    const { state: groupState, requestJoin } = useLegacySealedCommunity({
        pool: pool as any, // Cast to any to satisfy the local interface in use-sealed-community
        relayUrl,
        groupId,
        myPublicKeyHex: identityState.publicKeyHex || null,
        myPrivateKeyHex: identityState.privateKeyHex || null,
        enabled: open && !workspaceKernelJoin,
    });

    const [error, setError] = useState<string | null>(null);
    const [isJoining, setIsJoining] = useState(false);

    const handleJoin = async () => {
        try {
            setError(null);
            setIsJoining(true);
            const trust = await assertWorkspaceCommunityJoinAllowed({ communityRelayUrl: relayUrl });
            if (!trust.allowed) {
                setError(trust.userMessage);
                return;
            }
            ensureWorkspaceMembershipSyncMode();
            let kernelJoinedGroup: GroupConversation | undefined;
            if (workspaceKernelJoin) {
                if (!identityState.publicKeyHex || !identityState.privateKeyHex) {
                    setError("Identity must be unlocked to join a workspace community.");
                    return;
                }
                const communityId = deriveCommunityId({ groupId, relayUrl });
                const joinResult = await joinManagedWorkspaceMembership({
                    communityId,
                    groupId,
                    relayUrl,
                    displayName: groupState.metadata?.name || groupId,
                    memberPubkey: identityState.publicKeyHex,
                    actorPubkey: identityState.publicKeyHex,
                    actorPrivateKeyHex: identityState.privateKeyHex,
                    pool: poolRef.current,
                    addRelay: (relayParams) => relayList.addRelay(relayParams),
                    openRelayUrls: relayList.state.relays
                        .filter((relay) => relay.enabled)
                        .map((relay) => relay.url),
                });
                if (!joinResult.ok) {
                    setError(joinResult.userFacingMessage ?? joinResult.errorMessage);
                    return;
                }
                kernelJoinedGroup = joinResult.group;
            } else {
                await requestJoin();
            }

            // Add to local state for immediate UI update
            const resolvedRelayUrl = kernelJoinedGroup?.relayUrl || relayUrl;
            const resolvedCommunityId = kernelJoinedGroup?.communityId
                ?? (workspaceKernelJoin && identityState.publicKeyHex
                    ? resolveManagedWorkspaceCommunityId({
                        group: {
                            groupId,
                            relayUrl: resolvedRelayUrl,
                            communityId: deriveCommunityId({ groupId, relayUrl: resolvedRelayUrl }),
                        },
                        publicKeyHex: identityState.publicKeyHex,
                        profileId: getResolvedProfileId(),
                    })
                    : deriveCommunityId({ groupId, relayUrl: resolvedRelayUrl }));
            const joinedGroup = kernelJoinedGroup ?? {
                kind: "group" as const,
                id: toGroupConversationId({ groupId, relayUrl: resolvedRelayUrl, communityId: resolvedCommunityId }),
                groupId,
                relayUrl: resolvedRelayUrl,
                communityId: resolvedCommunityId,
                communityMode: "managed_workspace" as const,
                displayName: groupState.metadata?.name || groupId,
                memberPubkeys: [], // Will be populated by live subscription
                lastMessage: "Joining community...",
                unreadCount: 0,
                lastMessageTime: new Date(),
                access: "open" as const,
                memberCount: 0,
                adminPubkeys: [], // Will be hydrated
                avatar: groupState.metadata?.picture
            };
            addGroup(joinedGroup, {
                allowRevive: true,
                relayConfirmed: workspaceKernelJoin,
            });
            dispatchGroupInviteReceived(joinedGroup);

            onSuccess?.();
            onOpenChange(false);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to join community");
        } finally {
            setIsJoining(false);
        }
    };

    if (!open || !groupState.metadata) return null;
    const group = groupState.metadata;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-[425px] bg-background rounded-[32px] overflow-hidden shadow-2xl border border-border/50 animate-in zoom-in-95 duration-200">
                <button
                    onClick={() => onOpenChange(false)}
                    className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/5 hover:bg-black/10 transition-colors"
                >
                    <X className="h-4 w-4" />
                </button>

                <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-br from-primary/20 to-secondary/20" />

                <div className="relative pt-12 px-6 pb-6">
                    <div className="flex justify-center mb-6">
                        <Avatar className="h-24 w-24 border-4 border-background shadow-xl">
                            <AvatarImage src={group.picture} alt={group.name} />
                            <AvatarFallback className="text-3xl font-bold bg-primary/10">
                                {group.name?.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                    </div>

                    <h2 className="text-center text-2xl font-black tracking-tight mb-2">
                        Join {group.name}
                    </h2>
                    <p className="text-center text-sm text-muted-foreground mb-8 text-balance">
                        {group.about || "A private community on Obscur"}
                    </p>

                    <div className="grid grid-cols-2 gap-4 mb-8">
                        <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-muted/30 border border-border/50">
                            <Users className="h-5 w-5 text-primary mb-2" />
                            <span className="text-sm font-bold">Community</span>
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Secure Group</span>
                        </div>
                        <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-muted/30 border border-border/50">
                            <ShieldCheck className="h-5 w-5 text-secondary mb-2" />
                            <span className="text-sm font-bold">Moderated</span>
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Permissioned</span>
                        </div>
                    </div>

                    {workspaceJoinBlocked ? (
                        <div
                            className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 mb-6 text-center text-xs text-rose-900 dark:text-rose-100"
                            data-testid="group-join-workspace-blocked"
                        >
                            <p className="font-bold">{workspaceTrust.userMessage}</p>
                            <p className="mt-1 opacity-90">{workspaceTrust.settingsHint}</p>
                            <button
                                type="button"
                                className="mt-2 font-bold uppercase tracking-widest underline"
                                onClick={() => {
                                    onOpenChange(false);
                                    router.push("/settings?tab=relays#membership-sync-settings");
                                }}
                            >
                                Open relay settings
                            </button>
                        </div>
                    ) : null}

                    {error && (
                        <div className="bg-destructive/10 text-destructive text-xs font-bold p-4 rounded-2xl mb-6 border border-destructive/20 text-center">
                            {error}
                        </div>
                    )}

                    <div className="flex flex-col gap-3">
                        <Button
                            onClick={handleJoin}
                            disabled={isJoining || workspaceJoinBlocked}
                            className="w-full h-14 rounded-2xl text-base font-bold bg-gradient-to-r from-primary to-secondary hover:shadow-lg transition-all"
                        >
                            {isJoining ? "Sending Request..." : "Join Community"}
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={() => onOpenChange(false)}
                            className="w-full h-12 rounded-2xl text-sm font-bold text-muted-foreground"
                        >
                            Cancel
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
