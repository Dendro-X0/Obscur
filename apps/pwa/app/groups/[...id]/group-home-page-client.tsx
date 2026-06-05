"use client";

import React, { useEffect, useRef, useState } from "react";
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
    UserPlus,
    Ban,
    X,
    ChevronRight,
    ChevronLeft,
    Search,
    Settings,
    Trash2,
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
import { GroupManagementDialog } from "@/app/features/groups/components/group-management-dialog";
import type { GroupManagementTabId } from "@/app/features/groups/components/group-management/constants";
import { shouldMountGroupManagementDialog } from "@/app/features/groups/components/group-management-mount-policy";
import { cn } from "@dweb/ui-kit";
import { useMobileCompactLayout, useTabletSecondaryLayout } from "@/app/features/runtime/use-mobile-compact-layout";
import { useCommunityGovernanceProjection } from "@/app/features/groups/hooks/use-community-governance-projection";
import { useRelayList } from "@/app/features/relays/hooks/use-relay-list";
import { assessRelayCapability } from "@/app/features/groups/services/community-mode-contract";
import { resolveCommunityDirectoryMaterializationHonesty } from "@/app/features/groups/services/community-directory-materialization-policy";
import { readMembershipSyncMode } from "@/app/features/groups/services/community-membership-sync-mode";
import type { MembershipEvidenceUiContext } from "@/app/features/groups/utils/community-membership-evidence-display";
import { CommunityDirectoryHonestyNotice } from "@/app/features/groups/components/community-directory-honesty-notice";
import { CommunityLegacySovereignNotice } from "@/app/features/groups/components/community-legacy-sovereign-notice";
import { toScopedRelayUrl, useSealedCommunity } from "@/app/features/groups/hooks/use-sealed-community";
import { useCommunityParticipantRosterReadModel } from "@/app/features/groups/hooks/use-community-participant-roster-read-model";
import { toast } from "@dweb/ui-kit";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import Image from "next/image";
import { buildGroupBlockHref, buildGroupLeaveHref } from "@/app/features/groups/utils/group-action-route";
import { hasWritableCommunityRelayTransport } from "@/app/features/groups/services/community-relay-transport";
import { UserAvatar } from "@/app/features/profile/components/user-avatar";
import { useResolvedProfileMetadata } from "@/app/features/profile/hooks/use-resolved-profile-metadata";
import type { GroupAccessMode } from "@/app/features/groups/types";
import {
    dispatchGroupInviteReceived,
    dispatchGroupMembershipConfirmed,
} from "@/app/features/profiles/services/profile-bus-dispatch";
import { discoveryCache } from "@/app/features/search/services/discovery-cache";
import {
    isConversationNotificationsEnabled,
    setConversationNotificationsEnabled,
} from "@/app/features/notifications/utils/notification-target-preference";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { ProfileRegistryService } from "@/app/features/profiles/services/profile-registry-service";
import { getPublicGroupHref, getPublicProfileHref, toAbsoluteAppUrl } from "@/app/features/navigation/public-routes";
import { resolveGroupConversationByToken } from "@/app/features/messaging/utils/conversation-target";
import { resolveGroupRouteToken } from "@/app/features/groups/utils/group-route-token";
import { toGroupConversationId } from "@/app/features/groups/utils/group-conversation-id";
import { useAccessibilityPreferences } from "@/app/features/settings/hooks/use-accessibility-preferences";
import { logAppEvent } from "@/app/shared/log-app-event";
import { filterVisibleGroupMembers } from "@/app/features/groups/services/community-visible-members";
import { resolveCommunityDisplayName, PLACEHOLDER_GROUP_DISPLAY_NAME } from "@/app/features/groups/services/community-display-name";
import {
    loadCommunityMembershipLedger,
    toCommunityMembershipLedgerKey,
} from "@/app/features/groups/services/community-membership-ledger";
import { getResolvedClientGateway } from "@/app/features/profiles/services/resolve-client-gateway";
import { useIsDesktop } from "@/app/features/desktop/hooks/use-tauri";
import { shouldUseSafeCommunityRenderMode } from "@/app/features/groups/services/community-render-mode";
import {
    loadCommunityTerminalMembershipCache,
    mergeTerminalMemberPubkeys,
    stripTerminalCommunityMembersWithActiveEvidence,
} from "@/app/features/groups/services/community-terminal-membership-cache";
import {
    loadCommunityProvisionalMemberPubkeys,
    stripProvisionalCommunityMembersConfirmedOnRelay,
} from "@/app/features/groups/services/community-provisional-membership-cache";
import {
    clearCommunityTerminalMembershipEvidence,
    COMMUNITY_MEMBERSHIP_AUTO_RECONCILE_DEBOUNCE_MS,
    reconcileCommunityMembershipEvidence,
} from "@/app/features/groups/services/community-membership-evidence-actions";
import { reconcileWorkspaceMembershipEvidence } from "@/app/features/groups/services/community-workspace-membership-reconcile";
import { usesCoordinationMembershipDirectory } from "@/app/features/groups/services/community-workspace-transport-policy";
import { CommunityMembershipEvidenceChip } from "@/app/features/groups/components/community-membership-evidence-chip";
import {
    resolveCommunityMemberEvidenceTier,
    type CommunityMemberEvidenceTier,
    type CommunityTerminalMemberKind,
} from "@/app/features/groups/utils/community-member-evidence-tier";
import { CommunityMembershipEvidenceToolbar } from "@/app/features/groups/components/community-membership-evidence-toolbar";
import { collectGroupMessageAuthorPubkeys } from "@/app/features/groups/services/community-message-author-evidence";
import {
    ManagementControlCard,
    ManagementControlRow,
    ManagementSectionHeader,
} from "@/app/components/ui/management-control-row";
import { chatStateStoreService } from "@/app/features/messaging/services/chat-state-store";
import { resolveCommunityInviteMemberBlocklist } from "@/app/features/groups/services/community-invite-eligibility-read-model";
import {
    mergeCoordinationTerminalMemberPubkeys,
    resolveCommunityParticipantDisplayPubkeys,
    shouldApplyTerminalMembershipExclusionsToParticipantRoster,
} from "@/app/features/groups/services/community-participant-display-read-model";
import { useCoordinationMembershipDirectory } from "@/app/features/groups/hooks/use-coordination-membership-directory";
import { refreshCommunityMembershipTruth } from "@/app/features/groups/services/community-membership-truth";
import {
    assertWorkspaceCommunityJoinAllowed,
    useWorkspaceCommunityTrustGate,
} from "@/app/features/groups/hooks/use-workspace-community-trust-gate";
import { ensureWorkspaceMembershipSyncMode } from "@/app/features/groups/services/community-workspace-membership";
import { useDocumentPageVisible } from "@/app/features/runtime/use-document-page-visible";

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
    const {
        createdGroups,
        communityKnownParticipantDirectoryByConversationId,
        communityRosterByConversationId,
        addGroup,
    } = useGroups();
    const { setSelectedConversation } = useMessaging();
    const { state: identityState } = useIdentity();
    const { relayPool } = useRelay();
    const { blocklist, presence } = useNetwork();
    const { preferences } = useAccessibilityPreferences();
    const isDesktop = useIsDesktop();
    const discoveredRelay = searchParams.get("relay");
    const forceSafeRenderMode = searchParams.get("renderMode") === "safe";
    const [isMemberListOpen, setIsMemberListOpen] = useState(false);
    const [memberSearchQuery, setMemberSearchQuery] = useState("");
    const [provisionalOverlayEpoch, setProvisionalOverlayEpoch] = useState(0);
    const [onlinePage, setOnlinePage] = useState(1);
    const [offlinePage, setOfflinePage] = useState(1);
    const [isInviteConnectionsOpen, setIsInviteConnectionsOpen] = useState(false);
    const [isManagementOpen, setIsManagementOpen] = useState(false);
    const [managementInitialTab, setManagementInitialTab] = useState<GroupManagementTabId | undefined>(undefined);
    const openCommunityManagement = React.useCallback((tab?: GroupManagementTabId) => {
        setManagementInitialTab(tab);
        setIsManagementOpen(true);
    }, []);
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
    const lastParticipantProjectionSignatureRef = React.useRef<string | null>(null);
    const materializedGuestRouteKeyRef = React.useRef<string | null>(null);
    const safeVisualMode = shouldUseSafeCommunityRenderMode({
        forceSafeRenderMode,
        reducedMotion: preferences.reducedMotion,
        runtimeConstrained: runtimeCapability.constrained,
        isDesktop,
    });
    const compact = useMobileCompactLayout();
    const tablet = useTabletSecondaryLayout();
    const pageVisible = useDocumentPageVisible();

    const group = id ? (resolveGroupConversationByToken(createdGroups, id) ?? undefined) : undefined;
    const localMemberPubkey = (identityState.publicKeyHex || identityState.stored?.publicKeyHex || null) as PublicKeyHex | null;

    const effectiveRelay = toScopedRelayUrl(group?.relayUrl || discoveredRelay || "") ?? "";
    const relayHostLabel = effectiveRelay.replace(/^wss?:\/\//, "").split("/")[0] || effectiveRelay;
    const communityRelayTransportReady = React.useMemo(
        () => hasWritableCommunityRelayTransport(effectiveRelay),
        [effectiveRelay],
    );
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
                desktopRuntime: isDesktop,
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
        isDesktop,
        safeVisualMode,
    ]);

    const communityRosterProjection = group ? communityRosterByConversationId[group.id] : undefined;
    const communityKnownParticipantDirectory = group ? communityKnownParticipantDirectoryByConversationId[group.id] : undefined;
    const projectionMemberPubkeys = communityRosterProjection?.activeMemberPubkeys;
    const knownParticipantPubkeys = communityKnownParticipantDirectory?.participantPubkeys;

    const seededMemberEvidence = React.useMemo(
        () => getResolvedClientGateway().communityRoster.resolveSeedMemberPubkeysFromDirectory({
            directory: communityKnownParticipantDirectory ?? null,
            persistedGroupMemberPubkeys: group?.memberPubkeys,
            projectionMemberPubkeys,
            localMemberPubkey,
        }),
        [communityKnownParticipantDirectory, group?.memberPubkeys, localMemberPubkey, projectionMemberPubkeys],
    );

    const sealedCommunityShellEnabled = !!(group || discoveredRelay) && communityRelayTransportReady;
    const sealedCommunityController = useSealedCommunity({
        groupId: group?.groupId || id || "",
        relayUrl: effectiveRelay,
        communityId: group?.communityId,
        communityMode: group?.communityMode,
        pool: relayPool,
        myPublicKeyHex: identityState.publicKeyHex || null,
        myPrivateKeyHex: identityState.privateKeyHex || null,
        enabled: sealedCommunityShellEnabled,
        initialMembers: seededMemberEvidence,
    });
    const {
        state: groupState,
        updateMetadata,
        requestJoin: requestJoinNip29,
        refresh: refreshCommunityMembership,
        clearLocalTerminalMembershipEvidence,
        applyCoordinationSemanticMemberEvent,
    } = sealedCommunityController;

    const { activeProposals: activeGovernanceProposals, activeProposalCount } = useCommunityGovernanceProjection({
        groupId: group?.groupId || id || "",
        communityId: group?.communityId,
        enabled: sealedCommunityShellEnabled,
    });

    const relayList = useRelayList({ publicKeyHex: identityState.publicKeyHex || null });
    const { blocked: guestJoinBlocked, trust: guestJoinTrust } = useWorkspaceCommunityTrustGate({
        communityRelayUrl: effectiveRelay,
        active: isGuest && effectiveRelay.length > 0,
    });
    const handleGuestJoin = React.useCallback(async (): Promise<void> => {
        if (!effectiveRelay) {
            toast.error("Choose a community relay before joining.");
            return;
        }
        const trust = await assertWorkspaceCommunityJoinAllowed({
            communityRelayUrl: effectiveRelay,
            enabledRelayUrls: relayList.state.relays.map((relay) => relay.url),
        });
        if (!trust.allowed) {
            toast.error(trust.userMessage);
            return;
        }
        ensureWorkspaceMembershipSyncMode();
        await requestJoinNip29();
    }, [effectiveRelay, relayList.state.relays, requestJoinNip29]);
    const membershipSyncMode = readMembershipSyncMode();
    const membershipEvidenceUiContext = React.useMemo(
        (): MembershipEvidenceUiContext => ({ membershipSyncMode }),
        [membershipSyncMode],
    );
    const directoryHonesty = React.useMemo(
        () => resolveCommunityDirectoryMaterializationHonesty({
            communityMode: groupState.metadata?.communityMode ?? group?.communityMode,
            relayCapabilityTier: assessRelayCapability({
                enabledRelayUrls: relayList.state.relays.map((relay) => relay.url),
                selectedRelayHost: effectiveRelay,
            }).tier,
            membershipSyncMode,
        }),
        [
            effectiveRelay,
            group?.communityMode,
            groupState.metadata?.communityMode,
            membershipSyncMode,
            relayList.state.relays,
        ],
    );

    const terminalMembershipCache = React.useMemo(() => {
        const groupId = group?.groupId || id || "";
        if (!groupId || !effectiveRelay) {
            return null;
        }
        return loadCommunityTerminalMembershipCache({
            groupId,
            relayUrl: effectiveRelay,
            profileId: getResolvedProfileId(),
        });
    }, [effectiveRelay, group?.groupId, id]);

    const persistedConversationAuthorPubkeys = React.useMemo(() => {
        if (!localMemberPubkey || !group?.id) {
            return [] as ReadonlyArray<PublicKeyHex>;
        }
        return collectGroupMessageAuthorPubkeys({
            chatState: chatStateStoreService.load(localMemberPubkey),
            conversationId: group.id,
        });
    }, [group?.id, localMemberPubkey]);

    const rawLeftMemberPubkeys = React.useMemo(
        () => mergeTerminalMemberPubkeys(
            terminalMembershipCache?.leftMemberPubkeys ?? [],
            groupState.leftMembers,
        ),
        [groupState.leftMembers, terminalMembershipCache],
    );
    const rawExpelledMemberPubkeys = React.useMemo(
        () => mergeTerminalMemberPubkeys(
            terminalMembershipCache?.expelledMemberPubkeys ?? [],
            groupState.expelledMembers,
        ),
        [groupState.expelledMembers, terminalMembershipCache],
    );

    const { activeMemberPubkeys: activeMembers, authorEvidencePubkeys: conversationAuthorPubkeys } = React.useMemo(
        () => getResolvedClientGateway().communityRoster.resolveActiveMemberPubkeysFromConversation({
            communityMessages: groupState.messages ?? [],
            persistedMessageAuthorPubkeys: persistedConversationAuthorPubkeys,
            seededMemberPubkeys: seededMemberEvidence,
            projectionMemberPubkeys,
            localMemberPubkey,
            leftMemberPubkeys: rawLeftMemberPubkeys,
            expelledMemberPubkeys: rawExpelledMemberPubkeys,
        }),
        [
            rawExpelledMemberPubkeys,
            rawLeftMemberPubkeys,
            groupState.messages,
            localMemberPubkey,
            projectionMemberPubkeys,
            seededMemberEvidence,
        ],
    );
    const activeMembersFingerprint = React.useMemo(
        () => activeMembers.join(","),
        [activeMembers],
    );
    const conversationAuthorPubkeysFingerprint = React.useMemo(
        () => conversationAuthorPubkeys.join(","),
        [conversationAuthorPubkeys],
    );
    const rawLeftMemberPubkeysFingerprint = React.useMemo(
        () => rawLeftMemberPubkeys.join(","),
        [rawLeftMemberPubkeys],
    );
    const rawExpelledMemberPubkeysFingerprint = React.useMemo(
        () => rawExpelledMemberPubkeys.join(","),
        [rawExpelledMemberPubkeys],
    );
    const provisionalMemberPubkeys = React.useMemo(() => {
        const groupId = group?.groupId || id || "";
        if (!groupId || !effectiveRelay) {
            return [] as ReadonlyArray<PublicKeyHex>;
        }
        return loadCommunityProvisionalMemberPubkeys({
            groupId,
            relayUrl: effectiveRelay,
            profileId: getResolvedProfileId(),
        });
    }, [effectiveRelay, group?.groupId, id, provisionalOverlayEpoch]);
    const effectiveActiveMembers = React.useMemo(
        () => Array.from(new Set([...activeMembers, ...provisionalMemberPubkeys])) as ReadonlyArray<PublicKeyHex>,
        [activeMembers, provisionalMemberPubkeys],
    );
    const coordinationMembershipDirectory = useCoordinationMembershipDirectory(
        group?.communityId ?? group?.groupId ?? id,
    );
    const inviteEligibleMemberPubkeys = React.useMemo(
        () => resolveCommunityInviteMemberBlocklist({
            communityMode: group?.communityMode,
            coordinationDirectory: coordinationMembershipDirectory,
            hybridActiveMemberPubkeys: effectiveActiveMembers,
            leftMemberPubkeys: rawLeftMemberPubkeys,
            expelledMemberPubkeys: rawExpelledMemberPubkeys,
        }),
        [
            coordinationMembershipDirectory,
            effectiveActiveMembers,
            group?.communityMode,
            rawExpelledMemberPubkeys,
            rawLeftMemberPubkeys,
        ],
    );

    useEffect(() => {
        const groupId = group?.groupId || id || "";
        if (!groupId || !effectiveRelay || !pageVisible) {
            return;
        }
        const profileId = getResolvedProfileId();
        const terminalChanged = stripTerminalCommunityMembersWithActiveEvidence({
            groupId,
            relayUrl: effectiveRelay,
            profileId,
            relayBackedMemberPubkeys: activeMembers,
            conversationAuthorPubkeys,
            protectedTerminalMemberPubkeys: mergeTerminalMemberPubkeys(
                rawLeftMemberPubkeys,
                rawExpelledMemberPubkeys,
            ),
        });
        const provisionalChanged = stripProvisionalCommunityMembersConfirmedOnRelay({
            groupId,
            relayUrl: effectiveRelay,
            profileId,
            relayBackedMemberPubkeys: activeMembers,
        });
        if (terminalChanged || provisionalChanged) {
            setProvisionalOverlayEpoch((e) => e + 1);
        }
    }, [
        activeMembersFingerprint,
        conversationAuthorPubkeysFingerprint,
        effectiveRelay,
        group?.groupId,
        id,
        pageVisible,
        rawExpelledMemberPubkeysFingerprint,
        rawLeftMemberPubkeysFingerprint,
    ]);

    const refreshCommunityMembershipRef = useRef(refreshCommunityMembership);
    refreshCommunityMembershipRef.current = refreshCommunityMembership;
    useEffect(() => {
        const groupId = group?.groupId || id || "";
        if (!groupId || !effectiveRelay || !communityRelayTransportReady || !pageVisible) {
            return;
        }
        const timerId = window.setTimeout(() => {
            reconcileCommunityMembershipEvidence({
                groupId,
                relayUrl: effectiveRelay,
                profileId: getResolvedProfileId(),
                refreshRelaySubscription: () => {
                    refreshCommunityMembershipRef.current();
                },
            });
        }, COMMUNITY_MEMBERSHIP_AUTO_RECONCILE_DEBOUNCE_MS);
        return () => window.clearTimeout(timerId);
    }, [communityRelayTransportReady, effectiveRelay, group?.groupId, id, pageVisible]);

    const directoryParticipantPubkeys = React.useMemo(
        () => (knownParticipantPubkeys ?? []) as ReadonlyArray<PublicKeyHex>,
        [knownParticipantPubkeys],
    );
    const relayEvidenceConfidence = (
        groupState as { relayEvidenceRef?: { confidenceLevel: "seed_only" | "warming_up" | "partial_eose" | "steady_state" } }
    ).relayEvidenceRef?.confidenceLevel ?? "seed_only";
    const rosterLeftMemberPubkeys = React.useMemo(
        () => mergeCoordinationTerminalMemberPubkeys(
            rawLeftMemberPubkeys,
            coordinationMembershipDirectory,
            "left",
        ),
        [coordinationMembershipDirectory, rawLeftMemberPubkeys],
    );
    const rosterExpelledMemberPubkeys = React.useMemo(
        () => mergeCoordinationTerminalMemberPubkeys(
            rawExpelledMemberPubkeys,
            coordinationMembershipDirectory,
            "expelled",
        ),
        [coordinationMembershipDirectory, rawExpelledMemberPubkeys],
    );

    const { displayPubkeys: rosterDisplayPubkeys, authorEvidencePubkeys } = useCommunityParticipantRosterReadModel({
        conversationId: group?.id ?? "",
        directoryParticipantPubkeys,
        persistedGroupMemberPubkeys: (group?.memberPubkeys ?? []) as ReadonlyArray<PublicKeyHex>,
        projectionMemberPubkeys,
        rosterSeedPubkeys: seededMemberEvidence,
        communityMessages: groupState.messages ?? [],
        localMemberPubkey,
        leftMemberPubkeys: rosterLeftMemberPubkeys,
        expelledMemberPubkeys: rosterExpelledMemberPubkeys,
        relayEvidenceConfidence,
        persistedEvidenceOwnerPubkey: localMemberPubkey,
        ledgerGroupId: group?.groupId,
        ledgerRelayUrl: group?.relayUrl,
        applyTerminalMembershipExclusions: shouldApplyTerminalMembershipExclusionsToParticipantRoster(
            group?.communityMode,
            coordinationMembershipDirectory,
        ),
    });
    const participantDisplayPubkeys = React.useMemo(
        () => resolveCommunityParticipantDisplayPubkeys({
            communityMode: group?.communityMode,
            coordinationDirectory: coordinationMembershipDirectory,
            monotonicDisplayPubkeys: rosterDisplayPubkeys,
            localMemberPubkey,
        }),
        [
            coordinationMembershipDirectory,
            group?.communityMode,
            localMemberPubkey,
            rosterDisplayPubkeys,
        ],
    );
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
    /** Participant list follows coordination directory when R1; invite gates use inviteEligibleMemberPubkeys. */
    const visibleMembers = React.useMemo(
        () => filterVisibleGroupMembers(participantDisplayPubkeys, (pubkey) => discoveryCache.getProfile(pubkey)),
        [participantDisplayPubkeys],
    );
    const terminalParticipantSet = React.useMemo(
        () => new Set([
            ...rosterLeftMemberPubkeys,
            ...rosterExpelledMemberPubkeys,
        ].map((pubkey) => pubkey.trim().toLowerCase())),
        [rosterExpelledMemberPubkeys, rosterLeftMemberPubkeys],
    );
    const activeVisibleMembers = React.useMemo(
        () => visibleMembers.filter((pubkey) => !terminalParticipantSet.has(pubkey.trim().toLowerCase())),
        [terminalParticipantSet, visibleMembers],
    );
    const provisionalVisibleCount = React.useMemo(
        () => activeVisibleMembers.filter((pk) => (
            resolveCommunityMemberEvidenceTier(pk, {
                activeMemberPubkeys: activeMembers,
                provisionalMemberPubkeys,
            }) === "provisional"
        )).length,
        [activeMembers, activeVisibleMembers, provisionalMemberPubkeys],
    );
    const terminalRecordCount = React.useMemo(
        () => new Set([...rawLeftMemberPubkeys, ...rawExpelledMemberPubkeys]).size,
        [rawExpelledMemberPubkeys, rawLeftMemberPubkeys],
    );
    const displayMemberCount = activeVisibleMembers.length;
    const onlineMembers = React.useMemo(() => {
        if (!isMemberListOpen) {
            return [] as ReadonlyArray<string>;
        }
        return activeVisibleMembers.filter((pk) => presence.isPeerOnline(pk as PublicKeyHex));
    }, [activeVisibleMembers, isMemberListOpen, presence]);
    const offlineMembers = React.useMemo(() => {
        if (!isMemberListOpen) {
            return activeVisibleMembers;
        }
        return activeVisibleMembers.filter((pk) => !presence.isPeerOnline(pk as PublicKeyHex));
    }, [activeVisibleMembers, isMemberListOpen, presence]);

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

    const terminalMemberEntries = React.useMemo(() => {
        const leftSet = new Set(rawLeftMemberPubkeys.map((pk) => pk.trim().toLowerCase()));
        return [
            ...rawLeftMemberPubkeys.map((pubkey) => ({ pubkey, kind: "left" as const })),
            ...rawExpelledMemberPubkeys
                .filter((pubkey) => !leftSet.has(pubkey.trim().toLowerCase()))
                .map((pubkey) => ({ pubkey, kind: "expelled" as const })),
        ] as ReadonlyArray<Readonly<{ pubkey: PublicKeyHex; kind: CommunityTerminalMemberKind }>>;
    }, [rawExpelledMemberPubkeys, rawLeftMemberPubkeys]);
    const filteredTerminalMemberEntries = React.useMemo(
        () => terminalMemberEntries.filter((entry) => memberMatchesSearch(entry.pubkey)),
        [memberMatchesSearch, terminalMemberEntries],
    );

    const filteredOnlineMembers = React.useMemo(
        () => onlineMembers.filter((pubkey) => memberMatchesSearch(pubkey)),
        [memberMatchesSearch, onlineMembers]
    );
    const filteredOfflineMembers = React.useMemo(
        () => offlineMembers.filter((pubkey) => memberMatchesSearch(pubkey)),
        [offlineMembers, memberMatchesSearch]
    );

    useEffect(() => {
        if (!group || !isMemberListOpen) {
            return;
        }
        const signature = [
            group.id,
            knownParticipantPubkeys?.length ?? 0,
            projectionMemberPubkeys?.length ?? 0,
            authorEvidencePubkeys.length,
            activeMembers.length,
            provisionalMemberPubkeys.length,
            rosterDisplayPubkeys.length,
            activeVisibleMembers.length,
            groupState.membership.status,
        ].join("|");
        if (lastParticipantProjectionSignatureRef.current === signature) {
            return;
        }
        lastParticipantProjectionSignatureRef.current = signature;

        const visibleShrankBelowStable = activeVisibleMembers.length < rosterDisplayPubkeys.length;
        const projectionThinnerThanKnown =
            (projectionMemberPubkeys?.length ?? 0) < (knownParticipantPubkeys?.length ?? 0);
        const projectionThinnerThanAuthors =
            (projectionMemberPubkeys?.length ?? 0) < authorEvidencePubkeys.length;

        logAppEvent({
            name: "groups.page.participant_projection_state",
            level: visibleShrankBelowStable || projectionThinnerThanKnown || projectionThinnerThanAuthors ? "warn" : "info",
            scope: { feature: "groups", action: "participant_projection_state" },
            context: {
                conversationId: group.id,
                groupId: group.groupId,
                communityId: group.communityId ?? null,
                membershipStatus: groupState.membership.status,
                knownParticipantCount: knownParticipantPubkeys?.length ?? 0,
                rosterProjectionCount: projectionMemberPubkeys?.length ?? 0,
                authorEvidenceCount: authorEvidencePubkeys.length,
                activeParticipantCount: activeMembers.length,
                provisionalParticipantCount: provisionalMemberPubkeys.length,
                stableParticipantCount: rosterDisplayPubkeys.length,
                visibleParticipantCount: activeVisibleMembers.length,
                onlineParticipantCount: onlineMembers.length,
                offlineParticipantCount: offlineMembers.length,
                projectionThinnerThanKnown: projectionThinnerThanKnown ? 1 : 0,
                projectionThinnerThanAuthors: projectionThinnerThanAuthors ? 1 : 0,
                visibleShrankBelowStable: visibleShrankBelowStable ? 1 : 0,
            },
        });
    }, [
        activeMembers.length,
        activeVisibleMembers.length,
        authorEvidencePubkeys.length,
        group,
        groupState.membership.status,
        isMemberListOpen,
        knownParticipantPubkeys?.length,
        onlineMembers.length,
        offlineMembers.length,
        projectionMemberPubkeys?.length,
        provisionalMemberPubkeys.length,
        rosterDisplayPubkeys.length,
    ]);

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
            || effectiveActiveMembers.includes(myPublicKeyHex);
        if (!hasMembershipEvidence) {
            return;
        }
        const memberPubkeys = Array.from(new Set([...effectiveActiveMembers, myPublicKeyHex]));
        const adminPubkeys = (groupState.admins ?? [])
            .map((admin) => admin.pubkey)
            .filter((pubkey): pubkey is PublicKeyHex => typeof pubkey === "string" && pubkey.trim().length > 0);
        const ledgerDisplayName = (() => {
            const ledger = loadCommunityMembershipLedger(myPublicKeyHex, { profileId: getResolvedProfileId() });
            const key = toCommunityMembershipLedgerKey({ groupId: resolvedGroupId, relayUrl: effectiveRelay });
            if (!key) {
                return undefined;
            }
            return ledger.find((entry) => toCommunityMembershipLedgerKey(entry) === key)?.displayName;
        })();
        const displayName = resolveCommunityDisplayName({
            metadataName: groupState.metadata?.name,
            persistedDisplayName: ledgerDisplayName,
            groupId: resolvedGroupId,
            communityId: resolvedCommunityId,
            fallback: PLACEHOLDER_GROUP_DISPLAY_NAME,
        });
        const avatar = groupState.metadata?.picture;
        const access: GroupAccessMode = groupState.metadata?.access === "discoverable"
            ? "discoverable"
            : groupState.metadata?.access === "invite-only"
                ? "invite-only"
                : "open";

        const materializeRouteKey = `${resolvedGroupId}|${effectiveRelay}|${resolvedCommunityId ?? ""}`;
        if (materializedGuestRouteKeyRef.current === materializeRouteKey) {
            return;
        }
        materializedGuestRouteKeyRef.current = materializeRouteKey;

        const materializedGroup = {
            kind: "group" as const,
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
        };
        const membershipConfirmedDetail = {
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
            publicKeyHex: identityState.publicKeyHex ?? identityState.stored?.publicKeyHex,
        };
        queueMicrotask(() => {
            addGroup(materializedGroup, { allowRevive: true });
            dispatchGroupInviteReceived(materializedGroup);
            // M4: include publicKeyHex so the provider can reject events dispatched
            // for a different account in the same process (same-process A/B guard).
            dispatchGroupMembershipConfirmed(membershipConfirmedDetail);
        });
    }, [
        addGroup,
        effectiveActiveMembers,
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
    const notificationPreferenceProfileId = getResolvedProfileId();

    React.useEffect(() => {
        if (!group) return;
        setNotificationsEnabled(isConversationNotificationsEnabled(group, notificationPreferenceProfileId));

        const fetchRoomKey = async () => {
            const { roomKeyStore } = await import("@/app/features/crypto/room-key-store");
            const key = await roomKeyStore.getRoomKey(group.groupId);
            if (key?.trim()) {
                setRoomKeyHex(key.trim());
            }
        };
        void fetchRoomKey();
    }, [group?.groupId, group?.id, notificationPreferenceProfileId]);

    const toggleNotifications = () => {
        const next = !notificationsEnabled;
        setNotificationsEnabled(next);
        if (group) {
            setConversationNotificationsEnabled({
                conversation: group,
                enabled: next,
                profileId: getResolvedProfileId(),
            });
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
    useEffect(() => {
        if (!isMemberListOpen) {
            return;
        }
        const communityId = (resolvedCommunityId ?? group?.groupId ?? id ?? "").trim();
        if (!communityId) {
            return;
        }
        void refreshCommunityMembershipTruth({
            communityId,
            communityMode: group?.communityMode ?? groupState.metadata?.communityMode,
            localMemberPubkey,
            forceFull: true,
        });
    }, [
        group?.communityMode,
        group?.groupId,
        groupState.metadata?.communityMode,
        id,
        isMemberListOpen,
        localMemberPubkey,
        resolvedCommunityId,
    ]);
    const closeMemberList = (): void => {
        setIsMemberListOpen(false);
        setMemberSearchQuery("");
        setOnlinePage(1);
        setOfflinePage(1);
    };
    const handleReconcileMembership = React.useCallback(async (options?: Readonly<{ silent?: boolean }>) => {
        const groupId = group?.groupId || id || "";
        if (!groupId || !effectiveRelay) {
            if (!options?.silent) {
                toast.error("Community details are missing; cannot reconcile.");
            }
            return;
        }
        const communityMode = groupState.metadata?.communityMode ?? group?.communityMode;
        const outcome = await reconcileWorkspaceMembershipEvidence({
            groupId,
            relayUrl: effectiveRelay,
            profileId: getResolvedProfileId(),
            communityId: group?.communityId,
            communityMode,
            refreshRelaySubscription: refreshCommunityMembership,
            onSemanticMemberEvent: usesCoordinationMembershipDirectory(communityMode)
                ? applyCoordinationSemanticMemberEvent
                : undefined,
        });
        setProvisionalOverlayEpoch((e) => e + 1);
        if (options?.silent) {
            return;
        }
        if (outcome.coordination && !outcome.coordination.ok) {
            toast.error(
                t(
                    "groups.membershipEvidence.reconcileCoordinationFailed",
                    "Relay refresh started, but coordination directory sync failed. Check coordination URL and retry.",
                ),
            );
            return;
        }
        const coordinationApplied = outcome.coordination?.appliedDeltaCount ?? 0;
        toast.success(
            outcome.coordination
                ? t(
                    "groups.membershipEvidence.reconcileToastCoordination",
                    "Cleared provisional overlay, refreshed relay, and applied {{count}} coordination update(s).",
                    { count: coordinationApplied },
                )
                : t(
                    "groups.membershipEvidence.reconcileToast",
                    "Cleared provisional overlay and requested a fresh relay pull.",
                ),
        );
    }, [
        applyCoordinationSemanticMemberEvent,
        effectiveRelay,
        group?.communityId,
        group?.communityMode,
        group?.groupId,
        groupState.metadata?.communityMode,
        id,
        refreshCommunityMembership,
        t,
    ]);
    const refreshMembershipForInviteOpen = React.useCallback(
        () => handleReconcileMembership({ silent: true }),
        [handleReconcileMembership],
    );
    const handleClearTerminalMembership = React.useCallback(() => {
        const groupId = group?.groupId || id || "";
        if (!groupId || !effectiveRelay) {
            toast.error("Community details are missing; cannot clear terminal cache.");
            return;
        }
        clearCommunityTerminalMembershipEvidence({
            groupId,
            relayUrl: effectiveRelay,
            clearLocalTerminalMembershipEvidence,
            refreshRelaySubscription: refreshCommunityMembership,
        });
        toast.success(
            t(
                "groups.membershipEvidence.clearTerminalToast",
                "Terminal membership cache cleared. Refreshing relay membership.",
            ),
        );
    }, [clearLocalTerminalMembershipEvidence, effectiveRelay, group?.groupId, id, refreshCommunityMembership, t]);
    const displayName = resolveCommunityDisplayName({
        metadataName: groupState.metadata?.name,
        persistedDisplayName: group?.displayName,
        groupId: resolvedGroupId,
        communityId: resolvedCommunityId,
        fallback: "Community",
    });
    const groupActionRouteParams = React.useMemo(() => ({
        routeToken: (resolvedGroupId || group?.groupId || id || "").trim(),
        relayUrl: effectiveRelay || undefined,
        displayName,
        communityId: resolvedCommunityId,
    }), [displayName, effectiveRelay, group?.groupId, id, resolvedCommunityId, resolvedGroupId]);

    const activeProfileLabel = React.useMemo(() => {
        try {
            const registry = ProfileRegistryService.getState();
            return registry.profiles.find((profile) => profile.profileId === registry.activeProfileId)?.label
                ?? t("groups.personalControls.thisProfile", "this profile");
        } catch {
            return t("groups.personalControls.thisProfile", "this profile");
        }
    }, [t]);

    const handleDeleteCommunity = () => {
        if (!groupActionRouteParams.routeToken) {
            toast.error(t("groups.deleteCommunityMissingDetails", "Community details are missing; unable to delete."));
            return;
        }
        router.push(buildGroupLeaveHref({ ...groupActionRouteParams, leaveAction: "delete" }));
    };

    const handleBlockAction = () => {
        if (isBlocked) {
            handleToggleBlock();
            return;
        }
        if (!groupActionRouteParams.routeToken) {
            toast.error("Community details are missing; unable to open block confirmation.");
            return;
        }
        router.push(buildGroupBlockHref(groupActionRouteParams));
    };

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

    const rosterEvidenceHeaderExtras = (
        <>
            <CommunityLegacySovereignNotice
                communityMode={group?.communityMode ?? groupState.metadata?.communityMode}
                relayUrl={effectiveRelay}
                className="w-full max-w-2xl"
            />
            {!directoryHonesty.claimsAuthoritativeDirectory ? (
                <CommunityDirectoryHonestyNotice honesty={directoryHonesty} className="w-full max-w-2xl" />
            ) : null}
            {provisionalVisibleCount > 0 ? (
                <div className="flex items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/10 px-4 py-1.5 dark:border-amber-500/30 dark:bg-amber-500/10">
                    <span className="text-[11px] font-black uppercase tracking-widest text-amber-800 dark:text-amber-200">
                        {t("groups.membershipEvidence.heroProvisional", "{{count}} provisional on roster", { count: provisionalVisibleCount })}
                    </span>
                </div>
            ) : null}
            {terminalRecordCount > 0 ? (
                <div className="flex items-center gap-2 rounded-full border border-zinc-400/25 bg-zinc-500/10 px-4 py-1.5 dark:border-zinc-600/40 dark:bg-zinc-800/50">
                    <span className="text-[11px] font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-300">
                        {t("groups.membershipEvidence.heroTerminal", "{{count}} terminal (left/expelled)", { count: terminalRecordCount })}
                    </span>
                </div>
            ) : null}
        </>
    );

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
                    "mx-auto w-full px-4 sm:px-6",
                    compact ? "max-w-3xl pt-0 pb-28 space-y-3" : tablet ? "max-w-3xl pt-4 pb-28 space-y-6" : "max-w-5xl pt-20 pb-20 md:pb-0 space-y-12",
                    safeVisualMode ? "opacity-100" : "animate-in fade-in slide-in-from-bottom-4 duration-700",
                )}
            >
                {/* Back Button */}
                <div className={compact ? undefined : "pt-6"}>
                    <button
                        onClick={() => router.push("/network")}
                        className="group flex items-center gap-2 text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-white"
                    >
                        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                        <span className="text-xs font-black uppercase tracking-widest">Back to Network</span>
                    </button>
                </div>

                {activeProposalCount > 0 && (
                    <button
                        type="button"
                        onClick={() => openCommunityManagement("governance")}
                        className="w-full rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-left text-sm text-amber-950 transition-colors hover:bg-amber-500/15 dark:text-amber-100 dark:hover:bg-amber-500/20"
                    >
                        <p className="font-semibold">
                            {activeProposalCount === 1
                                ? "1 open governance proposal"
                                : `${activeProposalCount} open governance proposals`}
                        </p>
                        <p className="mt-1 text-xs opacity-90">
                            Open community management → Governance to review and vote.
                        </p>
                    </button>
                )}

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
                            "relative overflow-hidden shadow-2xl",
                            compact ? "rounded-2xl p-5 shadow-lg" : "rounded-[48px] p-8 sm:p-12",
                            safeVisualMode
                                ? "border-black/10 bg-white/95 dark:border-white/[0.05] dark:bg-[#0C0C0E]/95"
                                : "border-black/10 bg-white/75 backdrop-blur-xl dark:border-white/[0.03] dark:bg-[#0C0C0E]/80",
                        )}
                    >
                        {!compact ? (
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
                        ) : null}

                        <div className={cn(
                            "relative z-10 flex flex-col items-center md:items-start",
                            compact ? "gap-5 text-center" : "md:flex-row gap-10 md:gap-14",
                        )}>
                            {/* Avatar with Status Ring */}
                            <div className="relative shrink-0">
                                {safeVisualMode ? (
                                    <div className={cn("relative bg-gradient-to-br from-purple-500 to-indigo-600 shadow-2xl", compact ? "rounded-2xl p-1" : "rounded-[48px] p-1.5")}>
                                        <Avatar
                                            className={cn(
                                                "border-[6px] border-black/20 shadow-xl dark:border-[#0C0C0E]",
                                                compact ? "h-28 w-28 rounded-xl" : "h-44 w-44 rounded-[42px]",
                                            )}
                                        >
                                            <AvatarImage src={avatarUrl} className="object-cover" />
                                            <AvatarFallback className={cn(
                                                "bg-zinc-100 font-black text-zinc-900 dark:bg-[#1A1A1E] dark:text-white",
                                                compact ? "text-4xl" : "text-6xl",
                                            )}>
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
                                        className={cn(
                                            "relative bg-gradient-to-br from-purple-500 to-indigo-600 shadow-2xl",
                                            compact ? "rounded-2xl p-1" : "rounded-[48px] p-1.5",
                                        )}
                                    >
                                        <Avatar
                                            className={cn(
                                                "border-[6px] border-black/20 shadow-xl dark:border-[#0C0C0E]",
                                                compact ? "h-28 w-28 rounded-xl" : "h-44 w-44 rounded-[42px]",
                                            )}
                                        >
                                            <AvatarImage src={avatarUrl} className="object-cover" />
                                            <AvatarFallback className={cn(
                                                "bg-zinc-100 font-black text-zinc-900 dark:bg-[#1A1A1E] dark:text-white",
                                                compact ? "text-4xl" : "text-6xl",
                                            )}>
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
                            <div className={cn("flex-1 w-full text-center md:text-left", compact ? "space-y-4" : "space-y-8")}>
                                <div className={compact ? "space-y-2" : "space-y-4"}>
                                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                                        {safeVisualMode ? (
                                            <>
                                                <h1 className={cn(
                                                    "font-black tracking-tight text-zinc-950 dark:text-white",
                                                    compact ? "text-3xl" : "text-5xl sm:text-6xl",
                                                )}>
                                                    {displayName}
                                                </h1>
                                                <div className="flex items-center gap-2 rounded-full border border-black/10 bg-black/[0.04] px-3 py-1 dark:border-white/10 dark:bg-white/[0.05]">
                                                    <Globe className="h-3.5 w-3.5 text-purple-400" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-800 dark:text-zinc-400">
                                                        {compact ? relayHostLabel : effectiveRelay.replace("wss://", "")}
                                                    </span>
                                                </div>
                                                {!compact ? rosterEvidenceHeaderExtras : null}
                                            </>
                                        ) : (
                                            <>
                                                <motion.h1
                                                    initial={{ y: 20, opacity: 0 }}
                                                    animate={{ y: 0, opacity: 1 }}
                                                    transition={{ delay: 0.2 }}
                                                    className={cn(
                                                        "font-black tracking-tight text-zinc-950 dark:text-white",
                                                        compact ? "text-3xl" : "text-5xl sm:text-6xl",
                                                    )}
                                                >
                                                    {displayName}
                                                </motion.h1>
                                                <motion.div
                                                    initial={{ scale: 0.8, opacity: 0 }}
                                                    animate={{ scale: 1, opacity: 1 }}
                                                    transition={{ delay: 0.4 }}
                                                    className="flex items-center gap-2 rounded-full border border-black/10 bg-black/[0.04] px-3 py-1 dark:border-white/10 dark:bg-white/[0.05]"
                                                >
                                                    <Globe className="h-3.5 w-3.5 text-purple-400" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-800 dark:text-zinc-400">
                                                        {compact ? relayHostLabel : effectiveRelay.replace("wss://", "")}
                                                    </span>
                                                </motion.div>
                                                {!compact ? rosterEvidenceHeaderExtras : null}
                                            </>
                                        )}
                                    </div>
                                    <p className={cn(
                                        "mx-auto max-w-2xl font-medium leading-relaxed text-zinc-700 dark:text-zinc-400 md:mx-0",
                                        compact ? "text-sm line-clamp-3" : "text-xl",
                                    )}>
                                        {aboutText}
                                    </p>
                                </div>

                                {/* Premium Action Bar */}
                                <div className={cn(
                                    "flex w-full items-center justify-center md:justify-start",
                                    compact ? "flex-col gap-2" : "flex-wrap gap-3",
                                )}>
                                    {!isGuest ? (
                                        <Button
                                            onClick={handleEnterCommunityChat}
                                            className={cn(
                                                "rounded-xl border border-zinc-300 bg-white text-zinc-950 hover:bg-zinc-100 font-black shadow-lg shadow-zinc-900/5 transition-all hover:scale-[1.02] active:scale-95 gap-2 dark:border-white/10 dark:bg-white dark:text-black dark:hover:bg-zinc-200 dark:shadow-white/5",
                                                compact ? "h-11 w-full px-4 text-sm" : "h-16 px-10 rounded-2xl text-lg gap-3",
                                            )}
                                        >
                                            <MessageSquare className={compact ? "h-4 w-4" : "h-6 w-6"} />
                                            Enter Community Chat
                                        </Button>
                                    ) : (
                                        <Button
                                            onClick={() => void handleGuestJoin()}
                                            disabled={guestJoinBlocked}
                                            title={guestJoinBlocked ? guestJoinTrust.userMessage : undefined}
                                            className={cn(
                                                "rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black shadow-2xl shadow-purple-500/20 transition-all hover:scale-[1.02] active:scale-95 gap-2 disabled:opacity-50",
                                                compact ? "h-11 w-full px-4 text-sm" : "h-16 px-10 rounded-2xl text-lg gap-3",
                                            )}
                                        >
                                            <UserPlus className={compact ? "h-4 w-4" : "h-6 w-6"} />
                                            Join Community
                                        </Button>
                                    )}

                                    {!isGuest ? (
                                        compact ? (
                                            <div className="grid w-full grid-cols-2 gap-2">
                                                <Button
                                                    onClick={() => setIsInviteConnectionsOpen(true)}
                                                    disabled={!roomKeyHex}
                                                    title={roomKeyHex ? undefined : "Community room key is not on this device."}
                                                    className="h-10 gap-1.5 rounded-xl border border-zinc-300 bg-zinc-900 text-xs font-bold text-white dark:border-white/5 dark:bg-zinc-800/80"
                                                >
                                                    <UserPlus className="h-4 w-4" />
                                                    Invite
                                                </Button>
                                                {group ? (
                                                    <Button
                                                        onClick={() => openCommunityManagement()}
                                                        variant="outline"
                                                        className="h-10 gap-1.5 rounded-xl border border-zinc-300 bg-white text-xs font-bold text-zinc-900 hover:bg-zinc-50 dark:border-white/15 dark:bg-transparent dark:text-white dark:hover:bg-white/5"
                                                    >
                                                        <Settings className="h-4 w-4" />
                                                        Manage
                                                    </Button>
                                                ) : null}
                                            </div>
                                        ) : (
                                        <>
                                        <Button
                                            onClick={() => setIsInviteConnectionsOpen(true)}
                                            disabled={!roomKeyHex}
                                            title={roomKeyHex ? undefined : "Community room key is not on this device. Open Manage community → rotate room key if you created this community before the storage update, then invite again."}
                                            className={cn(
                                                "h-16 gap-3 rounded-2xl border border-black/10 bg-zinc-900/90 px-8 text-white transition-all hover:scale-[1.02] hover:bg-zinc-800/90 active:scale-95 dark:border-white/5 dark:bg-zinc-800/80 dark:hover:bg-zinc-700/80",
                                                safeVisualMode ? "backdrop-blur-none" : "backdrop-blur-md",
                                            )}
                                        >
                                            <UserPlus className="h-5 w-5" />
                                            Invite
                                        </Button>

                                    {group ? (
                                        <Button
                                            onClick={() => openCommunityManagement()}
                                            variant="outline"
                                            className={cn(
                                                "h-14 gap-2 rounded-2xl border border-zinc-300 bg-white px-6 font-bold text-zinc-900 transition-all hover:bg-zinc-50 active:scale-95 dark:border-white/15 dark:bg-transparent dark:text-white dark:hover:bg-white/5",
                                                safeVisualMode ? "backdrop-blur-none" : "backdrop-blur-md",
                                            )}
                                        >
                                            <Settings className="h-5 w-5" />
                                            Manage
                                        </Button>
                                    ) : null}
                                        </>
                                        )
                                    ) : null}

                                    {!isGuest ? (
                                    <div
                                        className={cn(
                                            "flex items-center rounded-xl border border-black/10 bg-black/[0.04] dark:border-white/5 dark:bg-white/[0.03]",
                                            compact
                                                ? "w-full justify-center gap-0.5 p-0.5"
                                                : "gap-2 rounded-2xl p-1",
                                            safeVisualMode ? "backdrop-blur-none" : "backdrop-blur-md",
                                        )}
                                    >
                                        <Button
                                            variant="ghost"
                                            onClick={toggleNotifications}
                                            className={cn(
                                                "rounded-lg transition-all hover:bg-black/[0.06] dark:hover:bg-white/5",
                                                compact ? "h-10 w-10" : "h-14 w-14 rounded-xl",
                                                notificationsEnabled ? "text-purple-600 dark:text-purple-400" : "text-zinc-600 dark:text-zinc-500",
                                            )}
                                            aria-label={notificationsEnabled ? "Disable notifications" : "Enable notifications"}
                                        >
                                            {notificationsEnabled ? (
                                                <Bell className={compact ? "h-4 w-4" : "h-6 w-6"} />
                                            ) : (
                                                <BellOff className={compact ? "h-4 w-4" : "h-6 w-6"} />
                                            )}
                                        </Button>

                                        <Button
                                            variant="ghost"
                                            className={cn(
                                                "rounded-lg text-zinc-600 transition-all hover:bg-black/[0.06] hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white",
                                                compact ? "h-10 w-10" : "h-14 w-14 rounded-xl",
                                            )}
                                            aria-label="Copy discovery link"
                                            onClick={() => {
                                                const url = toAbsoluteAppUrl(
                                                    getPublicGroupHref(group?.id || id || "", effectiveRelay || undefined),
                                                );
                                                navigator.clipboard.writeText(url);
                                                toast.success("Discovery link copied");
                                            }}
                                        >
                                            <Share2 className={compact ? "h-4 w-4" : "h-6 w-6"} />
                                        </Button>

                                        <div className={cn("bg-black/10 dark:bg-white/10", compact ? "mx-0.5 h-6 w-px" : "mx-1 h-8 w-[1px]")} />

                                        <Button
                                            variant="ghost"
                                            onClick={() => {
                                                if (!groupActionRouteParams.routeToken) {
                                                    toast.error("Community details are missing; unable to open leave confirmation.");
                                                    return;
                                                }
                                                router.push(buildGroupLeaveHref(groupActionRouteParams));
                                            }}
                                            className={cn(
                                                "rounded-lg text-rose-500 hover:bg-rose-500/10 transition-all active:scale-90",
                                                compact ? "h-10 w-10 hover:scale-105" : "h-14 w-14 rounded-xl hover:scale-110",
                                            )}
                                            aria-label="Leave community"
                                        >
                                            <LogOut className={compact ? "h-4 w-4" : "h-6 w-6"} />
                                        </Button>
                                    </div>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Bento Grid Stats */}
                <div className={cn(
                    "grid grid-cols-1",
                    compact ? "gap-3" : tablet ? "gap-4 sm:grid-cols-2" : "gap-6 md:grid-cols-4 lg:grid-cols-6",
                )}>
                    {/* Membership Card - Wide */}
                    <button
                        type="button"
                        onClick={openMemberList}
                        className={cn(
                            "text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60",
                            compact ? "rounded-2xl" : "rounded-[40px]",
                            tablet ? "sm:col-span-1" : "md:col-span-2 lg:col-span-3",
                        )}
                    >
                        <Card
                            className={cn(
                                "flex flex-col justify-between hover:border-purple-500/20 transition-all duration-500 group/bento overflow-hidden relative cursor-pointer",
                                compact ? "rounded-2xl p-4" : "rounded-[40px] p-8",
                                safeVisualMode
                                    ? "border-black/10 bg-white/95 dark:border-white/[0.05] dark:bg-[#0C0C0E]/90"
                                    : "border-black/10 bg-white/80 backdrop-blur-xl dark:border-white/[0.03] dark:bg-[#0C0C0E]/40",
                            )}
                        >
                            {!compact ? (
                            <div className="absolute -right-8 -bottom-8 opacity-[0.03] group-hover/bento:opacity-[0.08] transition-opacity duration-1000">
                                <Users size={240} className="text-zinc-900 dark:text-white" />
                            </div>
                            ) : null}
                            <div className={cn("relative z-10", compact ? "space-y-3" : "space-y-6")}>
                                <div className="flex items-center justify-between">
                                    <div className={cn("rounded-2xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20", compact ? "h-10 w-10" : "h-14 w-14")}>
                                        <Users className={cn("text-purple-400", compact ? "h-5 w-5" : "h-7 w-7")} />
                                    </div>
                                    <span className="px-3 py-1 rounded-full bg-purple-500/10 text-purple-800 text-[10px] font-black uppercase tracking-widest border border-purple-500/25 dark:text-purple-400 dark:border-purple-500/20">
                                        Participants
                                    </span>
                                </div>
                                <div className="space-y-1">
                                    <h3 className={cn("font-black text-zinc-900 dark:text-white", compact ? "text-lg" : "text-3xl")}>Community Access</h3>
                                    {!compact ? (
                                    <p className="font-medium text-zinc-700 dark:text-zinc-500">
                                        {directoryHonesty.claimsAuthoritativeDirectory
                                            ? "Open the encrypted chat, invite peers, and browse active members with leave and expulsion applied."
                                            : directoryHonesty.summary}
                                    </p>
                                    ) : (
                                    <p className="text-xs text-zinc-600 dark:text-zinc-500 line-clamp-2">
                                        {directoryHonesty.claimsAuthoritativeDirectory
                                            ? "Browse active members and invite peers."
                                            : directoryHonesty.summary}
                                    </p>
                                    )}
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 dark:text-zinc-500">
                                        {directoryHonesty.claimsAuthoritativeDirectory
                                            ? "Active membership evidence"
                                            : "Best-effort participant list"}
                                    </p>
                                </div>
                            </div>
                            <div className={cn("flex items-center gap-3 relative z-10", compact ? "pt-4" : "pt-8")}>
                                <div className="flex -space-x-3">
                                    {visibleMembers.slice(0, 5).map((pk, i) => (
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
                                    {visibleMembers.length > 5 && (
                                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border-[3px] border-white bg-zinc-100 text-xs font-black text-zinc-600 shadow-xl dark:border-[#0C0C0E] dark:bg-zinc-900 dark:text-zinc-500">
                                            +{visibleMembers.length - 5}
                                        </div>
                                    )}
                                </div>
                                <div className="h-1.5 w-1.5 rounded-full bg-zinc-400 mx-2 dark:bg-zinc-700" />
                                <span className="text-xs font-black uppercase tracking-widest text-zinc-800 dark:text-zinc-400">Open Participants</span>
                            </div>
                        </Card>
                    </button>

                    {/* Registry Visibility - Tall */}
                    <Card
                        className={cn(
                            "flex flex-col justify-between hover:border-indigo-500/20 transition-all duration-500 group/bento overflow-hidden relative",
                            compact ? "rounded-2xl p-4" : "rounded-[40px] p-8",
                            tablet ? "sm:col-span-1" : "md:col-span-2 lg:col-span-3",
                            safeVisualMode
                                ? "border-black/10 bg-white/95 dark:border-white/[0.05] dark:bg-[#0C0C0E]/90"
                                : "border-black/10 bg-white/80 backdrop-blur-xl dark:border-white/[0.03] dark:bg-[#0C0C0E]/40",
                        )}
                    >
                        {!compact ? (
                        <div className="absolute right-0 top-0 p-8">
                            <Shield className="h-10 w-10 text-indigo-500/20" />
                        </div>
                        ) : null}
                        <div className={compact ? "space-y-2" : "space-y-4"}>
                            {!compact ? (
                            <div className="h-14 w-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                                <Shield className="h-7 w-7 text-indigo-400" />
                            </div>
                            ) : null}
                            <h3 className={cn("font-black text-zinc-900 dark:text-white", compact ? "text-base" : "text-2xl")}>Registry & Privacy</h3>
                            <p className={cn("font-medium leading-relaxed text-zinc-700 dark:text-zinc-500", compact ? "text-xs" : "text-sm")}>
                                Visibility is <span className="font-black text-indigo-600 dark:text-indigo-400">{groupState.metadata?.access || "open"}</span>.
                                {compact
                                    ? (groupState.metadata?.access === "invite-only" ? " Invite-only registry." : " Listed in discovery.")
                                    : (groupState.metadata?.access === 'invite-only'
                                        ? " Access to this registry is strictly governed by invite-only protocols."
                                        : " This community is public and listed in the decentralized registry.")}
                            </p>
                        </div>
                        <div className={compact ? "pt-3" : "pt-6"}>
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500/5 border border-indigo-500/10">
                                <div className="h-1.5 w-1.5 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.5)]" />
                                <span className="text-[10px] font-black uppercase tracking-[0.1em] text-indigo-900 dark:text-indigo-300">Encrypted Storage</span>
                            </div>
                        </div>
                    </Card>

                    {/* Infrastructure Card - Wide Bottom */}
                    <Card
                        className={cn(
                            "flex flex-col items-center justify-between hover:border-zinc-500/20 transition-all duration-500 group/bento",
                            compact ? "gap-3 rounded-2xl p-4" : tablet ? "gap-4 rounded-3xl p-6 sm:col-span-2 sm:flex-row" : "gap-8 rounded-[40px] p-8 md:flex-row md:col-span-4 lg:col-span-6",
                            safeVisualMode
                                ? "border-black/10 bg-white/95 dark:border-white/[0.05] dark:bg-[#0C0C0E]/90"
                                : "border-black/10 bg-white/80 backdrop-blur-xl dark:border-white/[0.03] dark:bg-[#0C0C0E]/40",
                        )}
                    >
                        <div className={cn("flex items-center w-full min-w-0", compact ? "gap-3" : "gap-6")}>
                            <div className={cn("rounded-3xl bg-zinc-500/10 flex items-center justify-center border border-zinc-500/20 shrink-0", compact ? "h-10 w-10 rounded-xl" : "h-16 w-16")}>
                                <ExternalLink className={cn("text-zinc-500 dark:text-zinc-400", compact ? "h-4 w-4" : "h-8 w-8")} />
                            </div>
                            <div className="min-w-0 space-y-1">
                                <h3 className={cn("font-black text-zinc-900 dark:text-white", compact ? "text-base" : "text-2xl")}>Relay Infrastructure</h3>
                                <p className={cn("font-medium text-zinc-700 opacity-80 dark:text-zinc-500 truncate", compact ? "text-xs" : "text-sm font-mono")} title={effectiveRelay}>
                                    {compact ? relayHostLabel : effectiveRelay}
                                </p>
                            </div>
                        </div>
                        <div className={cn("flex items-center", compact ? "w-full justify-between gap-3" : "gap-8")}>
                            <div className={cn("text-right", compact ? "min-w-0 text-left flex-1" : "hidden sm:block")}>
                                <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1">Status</p>
                                <p className={cn("text-xs font-black", isRelayDegraded ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-green-500")}>{relayStatusLabel}</p>
                                {!compact ? (
                                <p className="mt-1 max-w-[220px] text-[10px] leading-snug text-zinc-600 dark:text-zinc-500">{relayStatusDetail}</p>
                                ) : null}
                            </div>
                            <div className={cn("rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shrink-0", compact ? "h-9 w-9" : "h-12 w-12", isRelayDegraded ? "bg-amber-500/10 border border-amber-500/20" : "bg-green-500/10 border border-green-500/20")}>
                                <div className={cn("h-3 w-3 rounded-full", isRelayDegraded ? "bg-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.6)]" : "bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.6)]")} />
                            </div>
                        </div>
                    </Card>
                </div>

                <div className="space-y-6">
                    <ManagementSectionHeader
                        title="Personal controls"
                        tone="danger"
                        description={
                            communityRelayTransportReady
                                ? "Block, delete, or unblock this community on your device. Open Manage for members, governance, relay settings, and invites."
                                : `This host is not a Nostr relay (${effectiveRelay}) — use Delete below, then recreate with a wss:// relay.`
                        }
                    />

                    <ManagementControlCard
                        className={cn(
                            safeVisualMode
                                ? "border-black/10 bg-white/95 dark:border-white/[0.05] dark:bg-[#0C0C0E]/90"
                                : "border-black/10 bg-white/80 dark:border-white/[0.03] dark:bg-[#0C0C0E]/40",
                        )}
                    >
                        <ManagementControlRow
                            icon={Ban}
                            title={isBlocked ? "Unblock community" : "Block community"}
                            description={
                                isBlocked
                                    ? "Allow messages and notifications from this community again"
                                    : "Hide this community from your inbox and stop notifications"
                            }
                            onClick={handleBlockAction}
                        />
                        <ManagementControlRow
                            icon={Trash2}
                            title="Delete community"
                            description={t(
                                "groups.deleteCommunityHint",
                                "Open the leave page to confirm removal of all local data for {{profileLabel}} (keeps your account).",
                                { profileLabel: activeProfileLabel },
                            )}
                            onClick={handleDeleteCommunity}
                            showDivider
                        />
                    </ManagementControlCard>
                </div>

                {!isGuest && group && shouldMountGroupManagementDialog(isManagementOpen) ? (
                    <GroupManagementDialog
                        isOpen
                        onClose={() => {
                            setIsManagementOpen(false);
                            setManagementInitialTab(undefined);
                        }}
                        initialTab={managementInitialTab}
                        group={group}
                        pool={relayPool}
                        myPublicKeyHex={identityState.publicKeyHex || null}
                        myPrivateKeyHex={identityState.privateKeyHex || null}
                        communityController={sealedCommunityController}
                    />
                ) : null}

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
                        onRefreshMembership={refreshMembershipForInviteOpen}
                        currentMemberPubkeys={inviteEligibleMemberPubkeys}
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
                                <div className="min-w-0 flex-1">
                                    <h3 className="text-xl font-black text-zinc-900 dark:text-white">Community Participants</h3>
                                    <p className="mt-1 text-xs font-bold uppercase tracking-widest text-zinc-600 dark:text-zinc-500">
                                        {directoryHonesty.claimsAuthoritativeDirectory
                                            ? t(
                                                membershipSyncMode === "coordination_preferred"
                                                    ? "groups.membershipEvidence.participantModalSubtitleCoordination"
                                                    : "groups.membershipEvidence.participantModalSubtitle",
                                                membershipSyncMode === "coordination_preferred"
                                                    ? "Directory sync, relay hints, and provisional members; leave/expulsion applied via kernel and terminal cache."
                                                    : "Relay hints and provisional members; leave/expulsion and terminal cache applied on this device.",
                                            )
                                            : directoryHonesty.detail}
                                    </p>
                                    {!directoryHonesty.claimsAuthoritativeDirectory ? (
                                        <button
                                            type="button"
                                            className="mt-2 text-[10px] font-bold uppercase tracking-widest text-sky-700 underline dark:text-sky-300"
                                            onClick={() => router.push("/settings?tab=relays#membership-sync-settings")}
                                        >
                                            {t("groups.openMembershipSyncSettings", "Open membership sync settings")}
                                        </button>
                                    ) : null}
                                </div>
                                <div className="flex shrink-0 items-start gap-2">
                                    <CommunityMembershipEvidenceToolbar
                                        terminalRecordCount={terminalRecordCount}
                                        onReconcile={handleReconcileMembership}
                                        onClearTerminalConfirmed={handleClearTerminalMembership}
                                    />
                                    <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9 shrink-0 text-zinc-600 hover:bg-black/[0.06] hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white"
                                    onClick={closeMemberList}
                                >
                                    <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                            <div className="border-b border-black/10 p-6 dark:border-white/10">
                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                                    <Input
                                        value={memberSearchQuery}
                                        onChange={(event) => setMemberSearchQuery(event.target.value)}
                                        placeholder="Search participants by name, pubkey, or profile info..."
                                        className="h-11 rounded-xl border-black/10 bg-black/[0.04] pl-10 text-zinc-900 placeholder:text-zinc-500 focus:border-emerald-400/40 focus:ring-emerald-400/25 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-100 dark:placeholder:text-zinc-500"
                                    />
                                </div>
                            </div>
                            <div className="grid gap-4 p-6 md:grid-cols-2 max-h-[70vh] overflow-y-auto">
                                <div className="space-y-3 rounded-2xl border border-emerald-500/20 bg-gradient-to-b from-emerald-500/[0.08] via-emerald-500/[0.03] to-transparent p-3">
                                    <h4 className="px-1 text-xs font-black uppercase tracking-widest text-emerald-400">Online</h4>
                                    {filteredOnlineMembers.length === 0 ? (
                                        <p className="px-1 py-2 text-xs text-zinc-600 dark:text-zinc-500">No online participants detected.</p>
                                    ) : (
                                        pagedOnlineMembers.map((pk) => (
                                            <MemberProfileRow
                                                key={`online-${pk}`}
                                                pubkey={pk}
                                                status="online"
                                                evidenceTier={resolveCommunityMemberEvidenceTier(pk, {
                                                    activeMemberPubkeys: activeMembers,
                                                    provisionalMemberPubkeys,
                                                })}
                                                membershipEvidenceUiContext={membershipEvidenceUiContext}
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
                                        <p className="px-1 py-2 text-xs text-zinc-600 dark:text-zinc-500">No offline participants detected.</p>
                                    ) : (
                                        pagedOfflineMembers.map((pk) => (
                                            <MemberProfileRow
                                                key={`offline-${pk}`}
                                                pubkey={pk}
                                                status="offline"
                                                evidenceTier={resolveCommunityMemberEvidenceTier(pk, {
                                                    activeMemberPubkeys: activeMembers,
                                                    provisionalMemberPubkeys,
                                                })}
                                                membershipEvidenceUiContext={membershipEvidenceUiContext}
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
                            {filteredTerminalMemberEntries.length > 0 ? (
                                <div className="border-t border-black/10 p-6 dark:border-white/10">
                                    <div className="space-y-3 rounded-2xl border border-zinc-400/25 bg-gradient-to-b from-zinc-500/[0.08] via-zinc-500/[0.03] to-transparent p-3">
                                        <h4 className="px-1 text-xs font-black uppercase tracking-widest text-zinc-600 dark:text-zinc-400">
                                            {t("groups.membershipEvidence.terminalSectionTitle", "Excluded from active roster")}
                                        </h4>
                                        {filteredTerminalMemberEntries.map((entry) => (
                                            <TerminalMemberProfileRow
                                                key={`terminal-${entry.kind}-${entry.pubkey}`}
                                                pubkey={entry.pubkey}
                                                terminalKind={entry.kind}
                                                membershipEvidenceUiContext={membershipEvidenceUiContext}
                                                onOpenProfile={(memberPubkey) => {
                                                    closeMemberList();
                                                    router.push(getPublicProfileHref(memberPubkey));
                                                }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    </div>
                )}

            </div>
        </PageShell>
    );
}

function TerminalMemberProfileRow({
    pubkey,
    terminalKind,
    membershipEvidenceUiContext,
    onOpenProfile,
}: Readonly<{
    pubkey: string;
    terminalKind: CommunityTerminalMemberKind;
    membershipEvidenceUiContext: MembershipEvidenceUiContext;
    onOpenProfile: (pubkey: string) => void;
}>): React.JSX.Element {
    const { t } = useTranslation();
    const metadata = useResolvedProfileMetadata(pubkey);
    const displayName = metadata?.displayName || `Member ${pubkey.slice(0, 8)}`;
    const kindLabel = terminalKind === "left"
        ? t("groups.membershipEvidence.terminalLeft", "Left")
        : t("groups.membershipEvidence.terminalExpelled", "Expelled");

    return (
        <button
            type="button"
            onClick={() => onOpenProfile(pubkey)}
            className="group w-full rounded-2xl border border-zinc-400/30 bg-gradient-to-r from-zinc-500/[0.12] via-zinc-500/[0.05] to-transparent p-3 text-left transition-all hover:border-zinc-400/45"
        >
            <div className="flex items-center gap-3">
                <UserAvatar
                    pubkey={pubkey}
                    size="sm"
                    showProfileOnClick={false}
                    className="rounded-xl border border-black/10 dark:border-white/10 opacity-80"
                />
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-black text-zinc-800 dark:text-zinc-200">{displayName}</p>
                        <CommunityMembershipEvidenceChip tier="terminal" uiContext={membershipEvidenceUiContext} />
                        <span className="shrink-0 rounded-full bg-zinc-500/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-300">
                            {kindLabel}
                        </span>
                    </div>
                </div>
                <ChevronRight className="h-4 w-4 text-zinc-500" />
            </div>
        </button>
    );
}

function MemberProfileRow({
    pubkey,
    status,
    evidenceTier,
    membershipEvidenceUiContext,
    onOpenProfile,
}: Readonly<{
    pubkey: string;
    status: "online" | "offline";
    evidenceTier: CommunityMemberEvidenceTier;
    membershipEvidenceUiContext: MembershipEvidenceUiContext;
    onOpenProfile: (pubkey: string) => void;
}>): React.JSX.Element | null {
    const metadata = useResolvedProfileMetadata(pubkey);
    const displayName = metadata?.displayName
        || `Member ${pubkey.slice(0, 8)}`;
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
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-black text-zinc-900 dark:text-zinc-100">{displayName}</p>
                        <CommunityMembershipEvidenceChip tier={evidenceTier} uiContext={membershipEvidenceUiContext} />
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
                        {metadata.isDeleted ? "Profile metadata unavailable" : "Identity hidden"}
                    </p>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-black/10 bg-black/[0.05] text-zinc-500 transition-colors group-hover:border-black/20 group-hover:text-zinc-900 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-400 dark:group-hover:border-white/20 dark:group-hover:text-white">
                    <ChevronRight className="h-4 w-4" />
                </div>
            </div>
        </button>
    );
}
