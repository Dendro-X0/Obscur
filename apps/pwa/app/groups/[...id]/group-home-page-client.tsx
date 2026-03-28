"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
    Users,
    MessageSquare,
    Shield,
    Globe,
    ArrowLeft,
    Share2,
    ExternalLink,
    Bell,
    BellOff,
    LogOut,
    Loader2,
    UserPlus,
    Ban,
    X,
    ChevronRight,
    ChevronLeft,
    Search
} from "lucide-react";
import { useGroups } from "@/app/features/groups/providers/group-provider";
import { useMessaging } from "@/app/features/messaging/providers/messaging-provider";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { useRelay } from "@/app/features/relays/providers/relay-provider";
import { PageShell } from "@/app/components/page-shell";
import { Button } from "@dweb/ui-kit";
import { Input } from "@dweb/ui-kit";
import { useNetwork } from "@/app/features/network/providers/network-provider";
import { Card } from "@dweb/ui-kit";
import { Avatar, AvatarFallback, AvatarImage } from "@dweb/ui-kit";
import { InviteConnectionsDialog } from "@/app/features/groups/components/invite-connections-dialog";
import { cn } from "@dweb/ui-kit";
import { toScopedRelayUrl, useSealedCommunity } from "@/app/features/groups/hooks/use-sealed-community";
import { useUploadService } from "@/app/features/messaging/lib/upload-service";
import { toast } from "@dweb/ui-kit";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import Image from "next/image";
import { ConfirmDialog } from "@/app/components/ui/confirm-dialog";
import { UserAvatar } from "@/app/features/profile/components/user-avatar";
import { useResolvedProfileMetadata } from "@/app/features/profile/hooks/use-resolved-profile-metadata";
import { discoveryCache } from "@/app/features/search/services/discovery-cache";
import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { getPublicGroupHref, getPublicProfileHref, toAbsoluteAppUrl } from "@/app/features/navigation/public-routes";
import { resolveGroupConversationByToken } from "@/app/features/messaging/utils/conversation-target";
import { resolveGroupRouteToken } from "@/app/features/groups/utils/group-route-token";
import { toGroupConversationId } from "@/app/features/groups/utils/group-conversation-id";
import { useAccessibilityPreferences } from "@/app/features/settings/hooks/use-accessibility-preferences";
import { logAppEvent } from "@/app/shared/log-app-event";
import { filterVisibleGroupMembers } from "@/app/features/groups/services/community-visible-members";

export default function GroupHomePage() {
    const MEMBERS_PER_PAGE = 20;
    const params = useParams();
    const searchParams = useSearchParams();
    const id = resolveGroupRouteToken({
        routeParam: params.id,
        queryId: searchParams.get("id"),
    });
    const router = useRouter();
    const { t } = useTranslation();
    const { createdGroups, addGroup, leaveGroup, updateGroup } = useGroups();
    const { setSelectedConversation } = useMessaging();
    const { state: identityState } = useIdentity();
    const { relayPool } = useRelay();
    const { blocklist, presence } = useNetwork();
    const { preferences } = useAccessibilityPreferences();
    const discoveredRelay = searchParams.get("relay");
    const forceSafeRenderMode = searchParams.get("renderMode") === "safe";
    const [isLeaving, setIsLeaving] = useState(false);
    const [isLeaveConfirmOpen, setIsLeaveConfirmOpen] = useState(false);
    const [isMemberListOpen, setIsMemberListOpen] = useState(false);
    const [memberSearchQuery, setMemberSearchQuery] = useState("");
    const [onlinePage, setOnlinePage] = useState(1);
    const [offlinePage, setOfflinePage] = useState(1);
    const [isBlockConfirmOpen, setIsBlockConfirmOpen] = useState(false);
    const [isInviteConnectionsOpen, setIsInviteConnectionsOpen] = useState(false);
    const [roomKeyHex, setRoomKeyHex] = useState<string>();
    const [runtimeCapability, setRuntimeCapability] = useState<Readonly<{
        hardwareConcurrency: number | null;
        deviceMemoryGb: number | null;
        constrained: boolean;
    }>>({
        hardwareConcurrency: null,
        deviceMemoryGb: null,
        constrained: false,
    });
    const didLogSafeRenderModeRef = React.useRef<boolean>(false);
    const safeVisualMode = forceSafeRenderMode || preferences.reducedMotion || runtimeCapability.constrained;

    const group = id ? (resolveGroupConversationByToken(createdGroups, id) ?? undefined) : undefined;

    const effectiveRelay = toScopedRelayUrl(group?.relayUrl || discoveredRelay || "") ?? "";
    const isGuest = !group;

    React.useEffect(() => {
        if (typeof navigator === "undefined") {
            return;
        }
        const hardwareConcurrency = typeof navigator.hardwareConcurrency === "number"
            ? navigator.hardwareConcurrency
            : null;
        const deviceMemoryGb = typeof (navigator as Navigator & { deviceMemory?: number }).deviceMemory === "number"
            ? (navigator as Navigator & { deviceMemory: number }).deviceMemory
            : null;
        const constrained = (
            (typeof hardwareConcurrency === "number" && hardwareConcurrency <= 4)
            || (typeof deviceMemoryGb === "number" && deviceMemoryGb <= 4)
        );
        setRuntimeCapability({
            hardwareConcurrency,
            deviceMemoryGb,
            constrained,
        });
    }, []);

    React.useEffect(() => {
        if (!safeVisualMode || didLogSafeRenderModeRef.current) {
            return;
        }
        didLogSafeRenderModeRef.current = true;
        logAppEvent({
            name: "groups.page.safe_render_mode_enabled",
            level: "info",
            scope: { feature: "groups", action: "page_render_mode" },
            context: {
                forcedByQuery: forceSafeRenderMode,
                reducedMotionEnabled: preferences.reducedMotion,
                constrainedDevice: runtimeCapability.constrained,
                hardwareConcurrency: runtimeCapability.hardwareConcurrency,
                deviceMemoryGb: runtimeCapability.deviceMemoryGb,
            },
        });
    }, [
        forceSafeRenderMode,
        preferences.reducedMotion,
        runtimeCapability.constrained,
        runtimeCapability.deviceMemoryGb,
        runtimeCapability.hardwareConcurrency,
        safeVisualMode,
    ]);

    const {
        state: groupState,
        updateMetadata,
        leaveGroup: leaveNip29Group,
        requestJoin: requestJoinNip29,
        members: discoveredMembers
    } = useSealedCommunity({
        groupId: group?.groupId || id || "",
        relayUrl: effectiveRelay,
        communityId: group?.communityId,
        pool: relayPool,
        myPublicKeyHex: identityState.publicKeyHex || null,
        myPrivateKeyHex: identityState.privateKeyHex || null,
        enabled: !!(group || discoveredRelay),
        initialMembers: group?.memberPubkeys as ReadonlyArray<PublicKeyHex> | undefined
    });

    const activeMembers = React.useMemo(() => {
        if (discoveredMembers && discoveredMembers.length > 0) {
            return discoveredMembers;
        }
        return group?.memberPubkeys || [];
    }, [discoveredMembers, group?.memberPubkeys]);

    const allKnownMembers = React.useMemo(() => {
        const merged = new Set<PublicKeyHex>([
            ...((group?.memberPubkeys as ReadonlyArray<PublicKeyHex> | undefined) ?? []),
            ...activeMembers
        ]);
        return Array.from(merged);
    }, [activeMembers, group?.memberPubkeys]);
    const fallbackGroupIdFromRoute = React.useMemo(() => {
        const routeToken = (id ?? "").trim();
        if (!routeToken) {
            return "";
        }
        if (routeToken.startsWith("community:") || routeToken.startsWith("group:") || routeToken.startsWith("v2_")) {
            return "";
        }
        return routeToken;
    }, [id]);
    const fallbackCommunityIdFromRoute = React.useMemo(() => {
        const routeToken = (id ?? "").trim();
        if (!routeToken.startsWith("community:")) {
            return "";
        }
        return routeToken.slice("community:".length).trim();
    }, [id]);
    const resolvedGroupId = React.useMemo(() => {
        const metadataGroupId = groupState.metadata?.id?.trim() ?? "";
        if (metadataGroupId.length > 0) {
            return metadataGroupId;
        }
        return group?.groupId ?? fallbackGroupIdFromRoute;
    }, [fallbackGroupIdFromRoute, group?.groupId, groupState.metadata?.id]);
    const resolvedCommunityId = React.useMemo(() => {
        if (group?.communityId) {
            return group.communityId;
        }
        return fallbackCommunityIdFromRoute || undefined;
    }, [fallbackCommunityIdFromRoute, group?.communityId]);
    const visibleMembers = React.useMemo(
        () => filterVisibleGroupMembers(allKnownMembers, (pubkey) => discoveryCache.getProfile(pubkey)),
        [allKnownMembers]
    );
    const displayMemberCount = visibleMembers.length;
    const onlineMembers = React.useMemo(
        () => visibleMembers.filter((pk) => presence.isPeerOnline(pk as PublicKeyHex)),
        [presence, visibleMembers]
    );
    const offlineMembers = React.useMemo(
        () => visibleMembers.filter((pk) => !presence.isPeerOnline(pk as PublicKeyHex)),
        [presence, visibleMembers]
    );

    const normalizedMemberSearch = memberSearchQuery.trim().toLowerCase();
    const memberMatchesSearch = React.useCallback((pubkey: string): boolean => {
        if (normalizedMemberSearch.length === 0) {
            return true;
        }
        const profile = discoveryCache.getProfile(pubkey);
        const haystack = [
            pubkey,
            profile?.displayName,
            profile?.name,
            profile?.nip05,
            profile?.about,
        ]
            .filter((value): value is string => typeof value === "string" && value.length > 0)
            .join(" ")
            .toLowerCase();
        return haystack.includes(normalizedMemberSearch);
    }, [normalizedMemberSearch]);

    const filteredOnlineMembers = React.useMemo(
        () => onlineMembers.filter((pubkey) => memberMatchesSearch(pubkey)),
        [memberMatchesSearch, onlineMembers]
    );
    const filteredOfflineMembers = React.useMemo(
        () => offlineMembers.filter((pubkey) => memberMatchesSearch(pubkey)),
        [offlineMembers, memberMatchesSearch]
    );

    const onlineTotalPages = Math.max(1, Math.ceil(filteredOnlineMembers.length / MEMBERS_PER_PAGE));
    const offlineTotalPages = Math.max(1, Math.ceil(filteredOfflineMembers.length / MEMBERS_PER_PAGE));

    const pagedOnlineMembers = React.useMemo(() => {
        const start = (onlinePage - 1) * MEMBERS_PER_PAGE;
        return filteredOnlineMembers.slice(start, start + MEMBERS_PER_PAGE);
    }, [filteredOnlineMembers, onlinePage, MEMBERS_PER_PAGE]);

    const pagedOfflineMembers = React.useMemo(() => {
        const start = (offlinePage - 1) * MEMBERS_PER_PAGE;
        return filteredOfflineMembers.slice(start, start + MEMBERS_PER_PAGE);
    }, [filteredOfflineMembers, offlinePage, MEMBERS_PER_PAGE]);

    React.useEffect(() => {
        setOnlinePage(1);
        setOfflinePage(1);
    }, [normalizedMemberSearch]);

    React.useEffect(() => {
        setOnlinePage((current) => Math.min(current, onlineTotalPages));
    }, [onlineTotalPages]);

    React.useEffect(() => {
        setOfflinePage((current) => Math.min(current, offlineTotalPages));
    }, [offlineTotalPages]);

    // Sync live member list back to the group provider so persistence stays current
    React.useEffect(() => {
        if (!group || discoveredMembers.length === 0) return;
        const current = group.memberPubkeys ?? [];
        const merged = Array.from(new Set([...current, ...discoveredMembers]));
        const nextMembers = filterVisibleGroupMembers(merged.filter((pubkey) => (
            !groupState.leftMembers.includes(pubkey) && !groupState.expelledMembers.includes(pubkey)
        )), (pubkey) => discoveryCache.getProfile(pubkey));
        const same = current.length === nextMembers.length &&
            nextMembers.every(pk => current.includes(pk));
        if (!same) {
            updateGroup({
                groupId: group.groupId,
                relayUrl: group.relayUrl,
                conversationId: group.id,
                updates: {
                    memberPubkeys: nextMembers,
                    memberCount: nextMembers.length
                }
            });
        }
    }, [discoveredMembers, group?.groupId, group?.id, group?.relayUrl, group?.memberPubkeys, groupState.expelledMembers, groupState.leftMembers, updateGroup]);

    React.useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }
        if (group) {
            return;
        }
        if (!effectiveRelay || !resolvedGroupId) {
            return;
        }
        const myPublicKeyHex = (identityState.publicKeyHex ?? identityState.stored?.publicKeyHex ?? null) as PublicKeyHex | null;
        if (!myPublicKeyHex) {
            return;
        }
        const hasMembershipEvidence = groupState.membership.status === "member"
            || allKnownMembers.includes(myPublicKeyHex);
        if (!hasMembershipEvidence) {
            return;
        }
        const memberPubkeys = Array.from(new Set([...allKnownMembers, myPublicKeyHex]));
        const adminPubkeys = (groupState.admins ?? [])
            .map((admin) => admin.pubkey)
            .filter((pubkey): pubkey is PublicKeyHex => typeof pubkey === "string" && pubkey.trim().length > 0);
        const displayName = groupState.metadata?.name || resolvedGroupId;
        const avatar = groupState.metadata?.picture;
        const access = groupState.metadata?.access === "discoverable"
            ? "discoverable"
            : groupState.metadata?.access === "invite-only"
                ? "invite-only"
                : "open";

        addGroup({
            kind: "group",
            id: toGroupConversationId({
                groupId: resolvedGroupId,
                relayUrl: effectiveRelay,
                communityId: resolvedCommunityId,
            }),
            communityId: resolvedCommunityId,
            groupId: resolvedGroupId,
            relayUrl: effectiveRelay,
            displayName,
            memberPubkeys,
            adminPubkeys,
            lastMessage: "Group membership confirmed",
            unreadCount: 0,
            lastMessageTime: new Date(),
            access,
            memberCount: Math.max(memberPubkeys.length, 1),
            avatar,
        }, { allowRevive: true });

        window.dispatchEvent(new CustomEvent("obscur:group-membership-confirmed", {
            detail: {
                groupId: resolvedGroupId,
                relayUrl: effectiveRelay,
                communityId: resolvedCommunityId,
                displayName,
                avatar,
                access,
                memberPubkeys,
                adminPubkeys,
                memberCount: Math.max(memberPubkeys.length, 1),
                lastMessageTimeUnixMs: Date.now(),
            },
        }));
    }, [
        addGroup,
        allKnownMembers,
        effectiveRelay,
        group,
        groupState.admins,
        groupState.membership.status,
        groupState.metadata?.access,
        groupState.metadata?.name,
        groupState.metadata?.picture,
        identityState.publicKeyHex,
        identityState.stored?.publicKeyHex,
        resolvedCommunityId,
        resolvedGroupId,
    ]);

    const handleEnterCommunityChat = React.useCallback(() => {
        if (!group) return;
        setSelectedConversation(group);
        router.push(`/?convId=${encodeURIComponent(group.id)}`);
    }, [group, router, setSelectedConversation]);

    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const getScopedGroupNotificationsKey = (groupId: string): string => getScopedStorageKey(`obscur_group_notifications_${groupId}`);
    const getLegacyGroupNotificationsKey = (groupId: string): string => `obscur_group_notifications_${groupId}`;

    React.useEffect(() => {
        if (!group) return;
        const saved =
            localStorage.getItem(getScopedGroupNotificationsKey(group.groupId))
            ?? localStorage.getItem(getLegacyGroupNotificationsKey(group.groupId));
        if (saved) {
            setNotificationsEnabled(saved === "on");
        }

        const fetchRoomKey = async () => {
            const { roomKeyStore } = await import("@/app/features/crypto/room-key-store");
            const key = await roomKeyStore.getRoomKey(group.groupId);
            if (key) setRoomKeyHex(key);
        };
        fetchRoomKey();
    }, [group?.groupId]);

    const toggleNotifications = () => {
        const next = !notificationsEnabled;
        setNotificationsEnabled(next);
        if (group) {
            localStorage.setItem(getScopedGroupNotificationsKey(group.groupId), next ? "on" : "off");
            toast.success(next ? "Notifications enabled" : "Notifications disabled");
        }
    };

    const handleToggleBlock = () => {
        const identifier = group?.groupId || id || "";
        if (blocklist.state.blockedPublicKeys.includes(identifier as any)) {
            blocklist.removeBlocked({ publicKeyHex: identifier as any });
            toast.success("Community unblocked");
        } else {
            blocklist.addBlocked({ publicKeyInput: identifier });
            toast.success("Community blocked");
        }
    };

    const isBlocked = blocklist?.state?.blockedPublicKeys?.includes((group?.groupId || id || "") as any) ?? false;
    const openMemberList = (): void => {
        setMemberSearchQuery("");
        setOnlinePage(1);
        setOfflinePage(1);
        setIsMemberListOpen(true);
    };
    const closeMemberList = (): void => {
        setIsMemberListOpen(false);
        setMemberSearchQuery("");
        setOnlinePage(1);
        setOfflinePage(1);
    };
    const handleBlockAction = () => {
        if (isBlocked) {
            handleToggleBlock();
            return;
        }
        setIsBlockConfirmOpen(true);
    };

    const handleLeave = async () => {
        setIsLeaving(true);
        try {
            await leaveNip29Group();
            leaveGroup({ groupId: group!.groupId, relayUrl: group!.relayUrl, conversationId: group!.id });
            router.push("/network");
            toast.success("Left community");
        } catch (error) {
            toast.error("Failed to leave community");
        } finally {
            setIsLeaving(false);
            setIsLeaveConfirmOpen(false);
        }
    };

    const displayName = groupState.metadata?.name || group?.displayName || "Community";
    const aboutText = groupState.metadata?.about || group?.about || "This resilient community is built on decentralized protocols. Privacy first, always.";
    const avatarUrl = groupState.metadata?.picture || group?.avatar;
    const relayScopeMismatchCount = groupState.relayFeedback.rejectionStats?.relayScopeMismatch ?? 0;
    const isRelayDegraded = relayScopeMismatchCount > 0 || Boolean(groupState.relayFeedback.lastNotice);
    const relayStatusLabel = isRelayDegraded ? "Degraded relay scope" : "Connected & optimized";
    const relayStatusDetail = isRelayDegraded
        ? (relayScopeMismatchCount > 0
            ? `${relayScopeMismatchCount} out-of-scope events ignored`
            : (groupState.relayFeedback.lastNotice ?? "Some events were filtered by safety checks"))
        : "All scoped events are flowing normally";

    if (!group && !discoveredRelay) {
        return (
            <PageShell title="Group Not Found">
                <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
                    <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-[24px] border border-black/10 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900">
                        <Users className="h-10 w-10 text-zinc-500 dark:text-zinc-600" />
                    </div>
                    <h1 className="mb-2 text-3xl font-black text-zinc-900 dark:text-white">Community Not Found</h1>
                    <p className="mb-8 max-w-sm text-zinc-600 dark:text-zinc-500">This group may have been deleted or you don&apos;t have access to it.</p>
                    <Button onClick={() => router.push("/network")} variant="secondary" className="rounded-xl px-8 font-black">
                        Back to Network
                    </Button>
                </div>
            </PageShell>
        );
    }

    return (
        <PageShell title={displayName}>
            <div
                className={cn(
                    "max-w-5xl mx-auto w-full pt-20 pb-20 md:pb-0 px-4 sm:px-6 space-y-12",
                    safeVisualMode ? "opacity-100" : "animate-in fade-in slide-in-from-bottom-4 duration-700",
                )}
            >
                {/* Back Button */}
                <div className="pt-6">
                    <button
                        onClick={() => router.push("/network")}
                        className="group flex items-center gap-2 text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-white"
                    >
                        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                        <span className="text-xs font-black uppercase tracking-widest">Back to Network</span>
                    </button>
                </div>

                {/* Immersive Hero Section */}
                <div className="relative group/hero">
                    {/* Background Ambient Glow */}
                    {!safeVisualMode && (
                        <>
                            <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full animate-pulse pointer-events-none" />
                            <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full animate-pulse pointer-events-none delay-700" />
                        </>
                    )}

                    <Card
                        className={cn(
                            "relative overflow-hidden rounded-[48px] p-8 sm:p-12 shadow-2xl",
                            safeVisualMode
                                ? "border-black/10 bg-white/95 dark:border-white/[0.05] dark:bg-[#0C0C0E]/95"
                                : "border-black/10 bg-white/75 backdrop-blur-xl dark:border-white/[0.03] dark:bg-[#0C0C0E]/80",
                        )}
                    >
                        {/* Immersive Blurred Banner Background */}
                        <div className="absolute inset-0 z-0 opacity-10 pointer-events-none overflow-hidden">
                            {avatarUrl ? (
                                <Image
                                    src={avatarUrl}
                                    alt=""
                                    fill
                                    className={cn(
                                        "object-cover",
                                        safeVisualMode ? "blur-sm scale-110" : "blur-3xl scale-150",
                                    )}
                                />
                            ) : (
                                <div
                                    className={cn(
                                        "absolute inset-0 bg-gradient-to-br from-purple-500/20 to-indigo-600/20",
                                        safeVisualMode ? "blur-sm" : "blur-3xl",
                                    )}
                                />
                            )}
                        </div>

                        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-10 md:gap-14">
                            {/* Avatar with Status Ring */}
                            <div className="relative shrink-0">
                                {safeVisualMode ? (
                                    <div className="relative p-1.5 rounded-[48px] bg-gradient-to-br from-purple-500 to-indigo-600 shadow-2xl">
                                        <Avatar
                                            className="h-44 w-44 rounded-[42px] border-[6px] border-black/20 shadow-xl dark:border-[#0C0C0E]"
                                        >
                                            <AvatarImage src={avatarUrl} className="object-cover" />
                                            <AvatarFallback className="bg-zinc-100 text-6xl font-black text-zinc-900 dark:bg-[#1A1A1E] dark:text-white">
                                                {displayName.slice(0, 1).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="absolute -bottom-2 -right-2 flex h-10 w-10 items-center justify-center rounded-2xl border-[6px] border-black/20 bg-green-500 shadow-lg dark:border-[#0C0C0E]">
                                            <div className="h-2.5 w-2.5 rounded-full bg-white" />
                                        </div>
                                    </div>
                                ) : (
                                    <motion.div
                                        initial={{ scale: 0.9, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        transition={{ duration: 0.5, ease: "easeOut" }}
                                        className="relative p-1.5 rounded-[48px] bg-gradient-to-br from-purple-500 to-indigo-600 shadow-2xl"
                                    >
                                        <Avatar
                                            className="h-44 w-44 rounded-[42px] border-[6px] border-black/20 shadow-xl dark:border-[#0C0C0E]"
                                        >
                                            <AvatarImage src={avatarUrl} className="object-cover" />
                                            <AvatarFallback className="bg-zinc-100 text-6xl font-black text-zinc-900 dark:bg-[#1A1A1E] dark:text-white">
                                                {displayName.slice(0, 1).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="absolute -bottom-2 -right-2 flex h-10 w-10 items-center justify-center rounded-2xl border-[6px] border-black/20 bg-green-500 shadow-lg transition-transform group-hover/hero:scale-110 dark:border-[#0C0C0E]">
                                            <div className="h-2.5 w-2.5 rounded-full bg-white animate-pulse" />
                                        </div>
                                    </motion.div>
                                )}
                            </div>

                            {/* Main Title & Description */}
                            <div className="flex-1 text-center md:text-left space-y-8">
                                <div className="space-y-4">
                                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                                        {safeVisualMode ? (
                                            <>
                                                <h1 className="text-5xl font-black tracking-tight text-zinc-950 dark:text-white sm:text-6xl">
                                                    {displayName}
                                                </h1>
                                                <div className="flex items-center gap-2 rounded-full border border-black/10 bg-black/[0.04] px-4 py-1.5 dark:border-white/10 dark:bg-white/[0.05]">
                                                    <Globe className="h-3.5 w-3.5 text-purple-400" />
                                                    <span className="text-[11px] font-black uppercase tracking-widest text-zinc-600 dark:text-zinc-400">
                                                        {effectiveRelay.replace("wss://", "")}
                                                    </span>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <motion.h1
                                                    initial={{ y: 20, opacity: 0 }}
                                                    animate={{ y: 0, opacity: 1 }}
                                                    transition={{ delay: 0.2 }}
                                                    className="text-5xl font-black tracking-tight text-zinc-950 dark:text-white sm:text-6xl"
                                                >
                                                    {displayName}
                                                </motion.h1>
                                                <motion.div
                                                    initial={{ scale: 0.8, opacity: 0 }}
                                                    animate={{ scale: 1, opacity: 1 }}
                                                    transition={{ delay: 0.4 }}
                                                    className="flex items-center gap-2 rounded-full border border-black/10 bg-black/[0.04] px-4 py-1.5 dark:border-white/10 dark:bg-white/[0.05]"
                                                >
                                                    <Globe className="h-3.5 w-3.5 text-purple-400" />
                                                    <span className="text-[11px] font-black uppercase tracking-widest text-zinc-600 dark:text-zinc-400">
                                                        {effectiveRelay.replace("wss://", "")}
                                                    </span>
                                                </motion.div>
                                            </>
                                        )}
                                    </div>
                                    <p className="max-w-2xl text-xl font-medium leading-relaxed text-zinc-700 dark:text-zinc-400">
                                        {aboutText}
                                    </p>
                                </div>

                                {/* Premium Action Bar */}
                                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                                    {!isGuest ? (
                                        <Button
                                            onClick={handleEnterCommunityChat}
                                            className="h-16 px-10 rounded-2xl bg-white text-black hover:bg-zinc-200 font-black text-lg shadow-2xl shadow-white/5 transition-all hover:scale-[1.02] active:scale-95 gap-3"
                                        >
                                            <MessageSquare className="h-6 w-6" />
                                            Enter Community Chat
                                        </Button>
                                    ) : (
                                        <Button
                                            onClick={requestJoinNip29}
                                            className="h-16 px-10 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-black text-lg shadow-2xl shadow-purple-500/20 transition-all hover:scale-[1.02] active:scale-95 gap-3"
                                        >
                                            <UserPlus className="h-6 w-6" />
                                            Join Community
                                        </Button>
                                    )}

                                    {!isGuest && (
                                        <Button
                                            onClick={() => setIsInviteConnectionsOpen(true)}
                                            className={cn(
                                                "h-16 gap-3 rounded-2xl border border-black/10 bg-zinc-900/90 px-8 text-white transition-all hover:scale-[1.02] hover:bg-zinc-800/90 active:scale-95 dark:border-white/5 dark:bg-zinc-800/80 dark:hover:bg-zinc-700/80",
                                                safeVisualMode ? "backdrop-blur-none" : "backdrop-blur-md",
                                            )}
                                        >
                                            <UserPlus className="h-5 w-5" />
                                            Invite
                                        </Button>
                                    )}

                                    <div
                                        className={cn(
                                            "flex items-center gap-2 rounded-2xl border border-black/10 bg-black/[0.04] p-1 dark:border-white/5 dark:bg-white/[0.03]",
                                            safeVisualMode ? "backdrop-blur-none" : "backdrop-blur-md",
                                        )}
                                    >
                                        {!isGuest && (
                                            <Button
                                                variant="ghost"
                                                onClick={toggleNotifications}
                                                className={cn(
                                                    "h-14 w-14 rounded-xl transition-all hover:bg-black/[0.06] dark:hover:bg-white/5",
                                                    notificationsEnabled ? "text-purple-600 dark:text-purple-400" : "text-zinc-600 dark:text-zinc-500"
                                                )}
                                            >
                                                {notificationsEnabled ? <Bell className="h-6 w-6" /> : <BellOff className="h-6 w-6" />}
                                            </Button>
                                        )}

                                        {!isGuest && (
                                            <Button
                                                variant="ghost"
                                                className="h-14 w-14 rounded-xl text-zinc-600 transition-all hover:bg-black/[0.06] hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white"
                                                onClick={() => {
                                                    const url = toAbsoluteAppUrl(
                                                        getPublicGroupHref(group?.id || id || "", effectiveRelay || undefined)
                                                    );
                                                    navigator.clipboard.writeText(url);
                                                    toast.success("Discovery link copied");
                                                }}
                                            >
                                                <Share2 className="h-6 w-6" />
                                            </Button>
                                        )}

                                        {!isGuest && (
                                            <>
                                                <div className="mx-1 h-8 w-[1px] bg-black/10 dark:bg-white/10" />

                                                <Button
                                                    variant="ghost"
                                                    onClick={() => setIsLeaveConfirmOpen(true)}
                                                    disabled={isLeaving}
                                                    className="h-14 w-14 rounded-xl text-rose-500 hover:bg-rose-500/10 transition-all hover:scale-110 active:scale-90"
                                                >
                                                    {isLeaving ? <Loader2 className="h-6 w-6 animate-spin" /> : <LogOut className="h-6 w-6" />}
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Bento Grid Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-6">
                    {/* Membership Card - Wide */}
                    <button
                        type="button"
                        onClick={openMemberList}
                        className="md:col-span-2 lg:col-span-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60 rounded-[40px]"
                    >
                        <Card
                            className={cn(
                                "rounded-[40px] p-8 flex flex-col justify-between hover:border-purple-500/20 transition-all duration-500 group/bento overflow-hidden relative cursor-pointer",
                                safeVisualMode
                                    ? "border-black/10 bg-white/95 dark:border-white/[0.05] dark:bg-[#0C0C0E]/90"
                                    : "border-black/10 bg-white/80 backdrop-blur-xl dark:border-white/[0.03] dark:bg-[#0C0C0E]/40",
                            )}
                        >
                            <div className="absolute -right-8 -bottom-8 opacity-[0.03] group-hover/bento:opacity-[0.08] transition-opacity duration-1000">
                                <Users size={240} className="text-zinc-900 dark:text-white" />
                            </div>
                            <div className="space-y-6 relative z-10">
                                <div className="flex items-center justify-between">
                                    <div className="h-14 w-14 rounded-2xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                                        <Users className="h-7 w-7 text-purple-400" />
                                    </div>
                                    <span className="px-5 py-1.5 rounded-full bg-purple-500/10 text-purple-400 text-xs font-black uppercase tracking-widest border border-purple-500/20">
                                        {groupState.membership.role}
                                    </span>
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-3xl font-black text-zinc-900 dark:text-white">Community</h3>
                                    <p className="font-medium text-zinc-700 dark:text-zinc-500">Connect with {displayMemberCount} active members in this space.</p>
                                    <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-600 dark:text-zinc-500">
                                        Click to view online and offline members
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 pt-8 relative z-10">
                                <div className="flex -space-x-3">
                                    {activeMembers.slice(0, 5).map((pk, i) => (
                                        <div
                                            key={pk}
                                            className="group-hover/bento:-translate-y-1 transition-transform"
                                            style={{ transitionDelay: `${i * 50}ms` }}
                                        >
                                            <UserAvatar
                                                pubkey={pk}
                                                size="md"
                                                metadataLive={false}
                                                showProfileOnClick={false}
                                                className="h-12 w-12 rounded-2xl border-[3px] border-white bg-zinc-100 shadow-lg dark:border-[#0C0C0E] dark:bg-[#1A1A1E]"
                                                fallbackClassName="bg-zinc-200 text-xs font-black text-zinc-900 dark:bg-[#1A1A1E] dark:text-white"
                                            />
                                        </div>
                                    ))}
                                    {activeMembers.length > 5 && (
                                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border-[3px] border-white bg-zinc-100 text-xs font-black text-zinc-600 shadow-xl dark:border-[#0C0C0E] dark:bg-zinc-900 dark:text-zinc-500">
                                            +{activeMembers.length - 5}
                                        </div>
                                    )}
                                </div>
                                <div className="h-1.5 w-1.5 rounded-full bg-zinc-700 mx-2" />
                                <span className="text-xs font-black uppercase tracking-widest text-zinc-600 dark:text-zinc-400">{t("connections.status.active", "Online Now")}</span>
                            </div>
                        </Card>
                    </button>

                    {/* Registry Visibility - Tall */}
                    <Card
                        className={cn(
                            "md:col-span-2 lg:col-span-3 rounded-[40px] p-8 flex flex-col justify-between hover:border-indigo-500/20 transition-all duration-500 group/bento overflow-hidden relative",
                            safeVisualMode
                                ? "border-black/10 bg-white/95 dark:border-white/[0.05] dark:bg-[#0C0C0E]/90"
                                : "border-black/10 bg-white/80 backdrop-blur-xl dark:border-white/[0.03] dark:bg-[#0C0C0E]/40",
                        )}
                    >
                        <div className="absolute right-0 top-0 p-8">
                            <Shield className="h-10 w-10 text-indigo-500/20" />
                        </div>
                        <div className="space-y-4">
                            <div className="h-14 w-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                                <Shield className="h-7 w-7 text-indigo-400" />
                            </div>
                            <h3 className="text-2xl font-black text-zinc-900 dark:text-white">Registry & Privacy</h3>
                            <p className="text-sm font-medium leading-relaxed text-zinc-700 dark:text-zinc-500">
                                Visibility is <span className="font-black text-indigo-600 dark:text-indigo-400">{groupState.metadata?.access || "open"}</span>.
                                {groupState.metadata?.access === 'invite-only'
                                    ? " Access to this registry is strictly governed by invite-only protocols."
                                    : " This community is public and listed in the decentralized registry."}
                            </p>
                        </div>
                        <div className="pt-6">
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500/5 border border-indigo-500/10">
                                <div className="h-1.5 w-1.5 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.5)]" />
                                <span className="text-[10px] font-black uppercase tracking-[0.1em] text-indigo-700 dark:text-indigo-300">Encrypted Storage</span>
                            </div>
                        </div>
                    </Card>

                    {/* Infrastructure Card - Wide Bottom */}
                    <Card
                        className={cn(
                            "md:col-span-4 lg:col-span-6 rounded-[40px] p-8 flex flex-col md:flex-row items-center justify-between gap-8 hover:border-zinc-500/20 transition-all duration-500 group/bento",
                            safeVisualMode
                                ? "border-black/10 bg-white/95 dark:border-white/[0.05] dark:bg-[#0C0C0E]/90"
                                : "border-black/10 bg-white/80 backdrop-blur-xl dark:border-white/[0.03] dark:bg-[#0C0C0E]/40",
                        )}
                    >
                        <div className="flex items-center gap-6">
                            <div className="h-16 w-16 rounded-3xl bg-zinc-500/10 flex items-center justify-center border border-zinc-500/20 shrink-0">
                                <ExternalLink className="h-8 w-8 text-zinc-500 dark:text-zinc-400" />
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-2xl font-black text-zinc-900 dark:text-white">Relay Infrastructure</h3>
                                <p className="text-sm font-medium font-mono text-zinc-700 opacity-80 dark:text-zinc-500">{effectiveRelay}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-8">
                            <div className="text-right hidden sm:block">
                                <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1">Status</p>
                                <p className={cn("text-xs font-black", isRelayDegraded ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-green-500")}>{relayStatusLabel}</p>
                                <p className="mt-1 max-w-[220px] text-[10px] leading-snug text-zinc-600 dark:text-zinc-500">{relayStatusDetail}</p>
                            </div>
                            <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform", isRelayDegraded ? "bg-amber-500/10 border border-amber-500/20" : "bg-green-500/10 border border-green-500/20")}>
                                <div className={cn("h-3 w-3 rounded-full", isRelayDegraded ? "bg-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.6)]" : "bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.6)]")} />
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Management Controls */}
                <div className="space-y-6">
                    <div className="flex items-center gap-3 px-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-600">
                            Management Controls
                        </h3>
                    </div>

                    <Card
                        className={cn(
                            "overflow-hidden rounded-[40px]",
                            safeVisualMode
                                ? "border-black/10 bg-white/95 dark:border-white/[0.05] dark:bg-[#0C0C0E]/90"
                                : "border-black/10 bg-white/80 backdrop-blur-xl dark:border-white/[0.03] dark:bg-[#0C0C0E]/40",
                        )}
                    >
                        <div className="flex flex-col">
                            <button
                                onClick={handleBlockAction}
                                className="flex items-center justify-between p-8 hover:bg-rose-500/[0.02] transition-colors group/item"
                            >
                                <div className="flex items-center gap-6">
                                    <div className="h-14 w-14 rounded-2xl bg-rose-500/10 flex items-center justify-center border border-rose-500/20 group-hover/item:scale-110 transition-transform">
                                        <Ban className="h-6 w-6 text-rose-500" />
                                    </div>
                                    <div className="text-left space-y-1">
                                        <p className="text-xl font-black text-zinc-900 transition-colors group-hover/item:text-rose-500 dark:text-white">
                                            {isBlocked ? "Unblock community" : "Block community"}
                                        </p>
                                        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-500">
                                            {isBlocked ? "Allow this community to appear in your network" : "Hide this community and ignore its events"}
                                        </p>
                                    </div>
                                </div>
                            </button>
                        </div>
                    </Card>
                </div>

                {!isGuest && group && (
                    <InviteConnectionsDialog
                        isOpen={isInviteConnectionsOpen}
                        onClose={() => setIsInviteConnectionsOpen(false)}
                        groupId={group.groupId}
                        relayUrl={group.relayUrl}
                        roomKeyHex={roomKeyHex || ""}
                        communityId={group.communityId}
                        genesisEventId={group.genesisEventId}
                        creatorPubkey={group.creatorPubkey}
                        currentMemberPubkeys={activeMembers}
                        metadata={{
                            id: group.groupId,
                            name: displayName,
                            about: aboutText,
                            picture: avatarUrl || "",
                            access: groupState.metadata?.access || "invite-only"
                        }}
                    />
                )}

                {isMemberListOpen && (
                    <div
                        className="fixed inset-0 z-[140] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
                        onClick={closeMemberList}
                    >
                        <div
                            className="w-full max-w-2xl overflow-hidden rounded-[28px] border border-black/10 bg-white/95 shadow-2xl dark:border-white/10 dark:bg-[#0C0C0E]"
                            onClick={(event) => event.stopPropagation()}
                        >
                            <div className="flex items-start justify-between gap-4 border-b border-black/10 p-6 dark:border-white/10">
                                <div>
                                    <h3 className="text-xl font-black text-zinc-900 dark:text-white">Community Members</h3>
                                    <p className="mt-1 text-xs font-bold uppercase tracking-widest text-zinc-600 dark:text-zinc-500">
                                        {filteredOnlineMembers.length} online / {filteredOfflineMembers.length} offline
                                    </p>
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9 text-zinc-600 hover:bg-black/[0.06] hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white"
                                    onClick={closeMemberList}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                            <div className="border-b border-black/10 p-6 dark:border-white/10">
                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                                    <Input
                                        value={memberSearchQuery}
                                        onChange={(event) => setMemberSearchQuery(event.target.value)}
                                        placeholder="Search members by name, pubkey, or profile info..."
                                        className="h-11 rounded-xl border-black/10 bg-black/[0.04] pl-10 text-zinc-900 placeholder:text-zinc-500 focus:border-emerald-400/40 focus:ring-emerald-400/25 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-100 dark:placeholder:text-zinc-500"
                                    />
                                </div>
                            </div>
                            <div className="grid gap-4 p-6 md:grid-cols-2 max-h-[70vh] overflow-y-auto">
                                <div className="space-y-3 rounded-2xl border border-emerald-500/20 bg-gradient-to-b from-emerald-500/[0.08] via-emerald-500/[0.03] to-transparent p-3">
                                    <h4 className="px-1 text-xs font-black uppercase tracking-widest text-emerald-400">Online</h4>
                                    {filteredOnlineMembers.length === 0 ? (
                                        <p className="px-1 py-2 text-xs text-zinc-600 dark:text-zinc-500">No online members detected.</p>
                                    ) : (
                                        pagedOnlineMembers.map((pk) => (
                                            <MemberProfileRow
                                                key={`online-${pk}`}
                                                pubkey={pk}
                                                status="online"
                                                onOpenProfile={(memberPubkey) => {
                                                    closeMemberList();
                                                    router.push(getPublicProfileHref(memberPubkey));
                                                }}
                                            />
                                        ))
                                    )}
                                    {filteredOnlineMembers.length > MEMBERS_PER_PAGE && (
                                        <div className="flex items-center justify-between px-1 pt-1">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setOnlinePage((page) => Math.max(1, page - 1))}
                                                disabled={onlinePage <= 1}
                                                className="h-8 rounded-lg border border-black/10 bg-black/[0.04] px-3 text-zinc-600 hover:text-zinc-900 disabled:opacity-40 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300 dark:hover:text-white"
                                            >
                                                <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                                                Prev
                                            </Button>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                                                Page {onlinePage} / {onlineTotalPages}
                                            </p>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setOnlinePage((page) => Math.min(onlineTotalPages, page + 1))}
                                                disabled={onlinePage >= onlineTotalPages}
                                                className="h-8 rounded-lg border border-black/10 bg-black/[0.04] px-3 text-zinc-600 hover:text-zinc-900 disabled:opacity-40 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300 dark:hover:text-white"
                                            >
                                                Next
                                                <ChevronRight className="ml-1 h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-3 rounded-2xl border border-violet-400/20 bg-gradient-to-b from-violet-500/[0.08] via-indigo-500/[0.03] to-transparent p-3">
                                    <h4 className="px-1 text-xs font-black uppercase tracking-widest text-violet-700 dark:text-violet-300">Offline</h4>
                                    {filteredOfflineMembers.length === 0 ? (
                                        <p className="px-1 py-2 text-xs text-zinc-600 dark:text-zinc-500">No offline members detected.</p>
                                    ) : (
                                        pagedOfflineMembers.map((pk) => (
                                            <MemberProfileRow
                                                key={`offline-${pk}`}
                                                pubkey={pk}
                                                status="offline"
                                                onOpenProfile={(memberPubkey) => {
                                                    closeMemberList();
                                                    router.push(getPublicProfileHref(memberPubkey));
                                                }}
                                            />
                                        ))
                                    )}
                                    {filteredOfflineMembers.length > MEMBERS_PER_PAGE && (
                                        <div className="flex items-center justify-between px-1 pt-1">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setOfflinePage((page) => Math.max(1, page - 1))}
                                                disabled={offlinePage <= 1}
                                                className="h-8 rounded-lg border border-black/10 bg-black/[0.04] px-3 text-zinc-600 hover:text-zinc-900 disabled:opacity-40 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300 dark:hover:text-white"
                                            >
                                                <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                                                Prev
                                            </Button>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                                                Page {offlinePage} / {offlineTotalPages}
                                            </p>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setOfflinePage((page) => Math.min(offlineTotalPages, page + 1))}
                                                disabled={offlinePage >= offlineTotalPages}
                                                className="h-8 rounded-lg border border-black/10 bg-black/[0.04] px-3 text-zinc-600 hover:text-zinc-900 disabled:opacity-40 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300 dark:hover:text-white"
                                            >
                                                Next
                                                <ChevronRight className="ml-1 h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <ConfirmDialog
                    isOpen={isBlockConfirmOpen}
                    onClose={() => setIsBlockConfirmOpen(false)}
                    onConfirm={() => {
                        handleToggleBlock();
                        setIsBlockConfirmOpen(false);
                    }}
                    title="Block community"
                    description={`Are you sure you want to block "${displayName}"? This will hide it and ignore its events.`}
                    confirmLabel="Block community"
                    cancelLabel="Cancel"
                    variant="danger"
                />

                <ConfirmDialog
                    isOpen={isLeaveConfirmOpen}
                    onClose={() => setIsLeaveConfirmOpen(false)}
                    onConfirm={handleLeave}
                    title="Leave Community"
                    description={`Are you sure you want to leave "${displayName}"? You will miss out on future updates and conversations.`}
                    confirmLabel="Leave Community"
                    cancelLabel="Stay for now"
                    variant="danger"
                    isLoading={isLeaving}
                />
            </div>
        </PageShell>
    );
}

function MemberProfileRow({
    pubkey,
    status,
    onOpenProfile
}: Readonly<{
    pubkey: string;
    status: "online" | "offline";
    onOpenProfile: (pubkey: string) => void;
}>): React.JSX.Element | null {
    const metadata = useResolvedProfileMetadata(pubkey);
    if (metadata.isDeleted) {
        return null;
    }
    const displayName = metadata?.displayName || "Unknown member";
    const statusLabel = status === "online" ? "Online" : "Offline";

    return (
        <button
            type="button"
            onClick={() => onOpenProfile(pubkey)}
            className={cn(
                "group w-full rounded-2xl border p-3 text-left transition-all",
                status === "online"
                    ? "border-emerald-400/30 bg-gradient-to-r from-emerald-500/[0.16] via-cyan-500/[0.08] to-transparent hover:border-emerald-300/40 hover:from-emerald-500/[0.2] hover:via-cyan-500/[0.12]"
                    : "border-violet-400/25 bg-gradient-to-r from-violet-500/[0.14] via-indigo-500/[0.08] to-transparent hover:border-violet-300/35 hover:from-violet-500/[0.18] hover:via-indigo-500/[0.12]"
            )}
        >
            <div className="flex items-center gap-3">
                <UserAvatar
                    pubkey={pubkey}
                    size="sm"
                    showProfileOnClick={false}
                    className="rounded-xl border border-black/10 dark:border-white/10"
                />
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-black text-zinc-900 dark:text-zinc-100">{displayName}</p>
                        <span
                            className={cn(
                                "shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest",
                                status === "online"
                                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-200"
                                    : "bg-violet-500/20 text-violet-700 dark:text-violet-200"
                            )}
                        >
                            {statusLabel}
                        </span>
                    </div>
                    <p className="mt-0.5 truncate text-[10px] uppercase tracking-[0.14em] text-zinc-600 dark:text-zinc-400">
                        Identity hidden
                    </p>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-black/10 bg-black/[0.05] text-zinc-500 transition-colors group-hover:border-black/20 group-hover:text-zinc-900 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-400 dark:group-hover:border-white/20 dark:group-hover:text-white">
                    <ChevronRight className="h-4 w-4" />
                </div>
            </div>
        </button>
    );
}


