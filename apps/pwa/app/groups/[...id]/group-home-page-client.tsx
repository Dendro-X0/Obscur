"use client";
import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Users, MessageSquare, Shield, Globe, ArrowLeft, Share2, ExternalLink, Bell, BellOff, LogOut, UserPlus, Ban, ChevronRight, Settings, Trash2, } from "lucide-react";
import { useGroups } from "@/app/features/groups/providers/group-provider-port";
import { useMessaging } from "@/app/features/messaging/providers/messaging-provider";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { useRelay } from "@/app/features/relays/providers/relay-provider";
import { PageShell } from "@/app/components/page-shell";
import { Button } from "@dweb/ui-kit/button";
import { useNetwork } from "@/app/features/network/providers/network-provider";
import { Card } from "@dweb/ui-kit/card";
import { Avatar, AvatarFallback, AvatarImage } from "@dweb/ui-kit/avatar";
import { InviteConnectionsDialog } from "@/app/features/groups/components/invite-connections-dialog";
import { GroupManagementDialog } from "@/app/features/groups/components/group-management-dialog";
import type { GroupManagementTabId } from "@/app/features/groups/components/group-management/constants";
import { shouldMountGroupManagementDialog } from "@/app/features/groups/components/group-management-mount-policy";
import { cn } from "@dweb/ui-kit/cn";
import { useMobileCompactLayout, useTabletSecondaryLayout } from "@/app/features/runtime/use-mobile-compact-layout";
import { useCommunityGovernanceProjection } from "@/app/features/groups/hooks/use-community-governance-projection";
import { useRelayList } from "@/app/features/relays/hooks/use-relay-list";
import { assessRelayCapability } from "@/app/features/groups/services/community-mode-contract";
import { resolveCommunityDirectoryMaterializationHonesty } from "@/app/features/groups/services/community-directory-materialization-policy";
import { readMembershipSyncMode } from "@/app/features/groups/services/community-membership-sync-mode";
import type { MembershipEvidenceUiContext } from "@/app/features/groups/utils/community-membership-evidence-display";
import { CommunityDirectoryHonestyNotice } from "@/app/features/groups/components/community-directory-honesty-notice";
import { CommunityLegacySovereignNotice } from "@/app/features/groups/components/community-legacy-sovereign-notice";
import { toScopedRelayUrl } from "@/app/features/groups/hooks/use-sealed-community-types";
import { useLegacySealedCommunity } from "@/app/features/groups/hooks/sealed-community-port";
import { useGroupThreadRelayIngest } from "@/app/features/groups/hooks/use-group-thread-relay-ingest";
import { useGroupHomeParticipantPubkeys } from "@/app/features/groups/hooks/use-group-home-participant-pubkeys";
import { toast } from "@dweb/ui-kit/toast";
import { roomKeyStore } from "@/app/features/crypto/room-key-store";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import Image from "next/image";
import { buildGroupBlockHref, buildGroupLeaveHref } from "@/app/features/groups/utils/group-action-route";
import { hasWritableCommunityRelayTransport } from "@/app/features/groups/services/community-relay-transport";
import { resolveGroupHomeGroupThreadRelayIngestEnabled, resolveGroupHomeSealedCommunityEnabled, } from "@/app/features/groups/services/sealed-community-instance-policy";
import { isGroupTombstoned } from "@/app/features/groups/services/group-tombstone-store";
import { isWorkspaceKernelAuthority } from "@/app/features/workspace-kernel/workspace-kernel-policy";
import { resolveWorkspaceKernelActiveMemberPubkeys } from "@/app/features/workspace-kernel/workspace-kernel-roster-port";
import { UserAvatar } from "@/app/features/profile/components/user-avatar";
import type { GroupAccessMode } from "@/app/features/groups/types";
import { dispatchGroupInviteReceived, dispatchGroupMembershipConfirmed, } from "@/app/features/profiles/services/profile-bus-dispatch";
import { discoveryCache } from "@/app/features/search/services/discovery-cache";
import { isConversationNotificationsEnabled, setConversationNotificationsEnabled, } from "@/app/features/notifications/utils/notification-target-preference";
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
import { loadCommunityMembershipLedger, toCommunityMembershipLedgerKey, } from "@/app/features/groups/services/community-membership-ledger";
import { getResolvedClientGateway } from "@/app/features/profiles/services/resolve-client-gateway";
import { useIsDesktop } from "@/app/features/desktop/hooks/use-tauri";
import { shouldUseSafeCommunityRenderMode } from "@/app/features/groups/services/community-render-mode";
import { loadCommunityTerminalMembershipCache, mergeTerminalMemberPubkeys, stripTerminalCommunityMembersWithActiveEvidence, } from "@/app/features/groups/services/community-terminal-membership-cache";
import { loadCommunityProvisionalMemberPubkeys, stripProvisionalCommunityMembersConfirmedOnRelay, } from "@/app/features/groups/services/community-provisional-membership-cache";
import { clearCommunityTerminalMembershipEvidence, COMMUNITY_MEMBERSHIP_AUTO_RECONCILE_DEBOUNCE_MS, reconcileCommunityMembershipEvidence, } from "@/app/features/groups/services/community-membership-evidence-actions";
import { reconcileWorkspaceMembershipEvidence } from "@/app/features/groups/services/community-workspace-membership-reconcile";
import { buildManagedWorkspaceRosterRepairContext } from "@/app/features/groups/services/managed-workspace-roster-repair-context";
import { resolveEffectiveCommunityMode } from "@/app/features/groups/services/community-workspace-r1-policy";
import { usesCoordinationMembershipDirectory } from "@/app/features/groups/services/community-workspace-transport-policy";
import { resolveCommunityMemberEvidenceTier, type CommunityTerminalMemberKind, } from "@/app/features/groups/utils/community-member-evidence-tier";
import { CommunityFindInCommunityPicker } from "@/app/features/groups/components/community-find-in-community-picker";
import { collectGroupMessageAuthorPubkeys } from "@/app/features/groups/services/community-message-author-evidence";
import { ManagementControlCard, ManagementControlRow, ManagementSectionHeader, } from "@/app/components/ui/management-control-row";
import { messagingChatStateReadPort } from "@/app/features/messaging/services/messaging-chat-state-read-port";
import { resolveCommunityInviteMemberBlocklist } from "@/app/features/groups/services/community-invite-eligibility-read-model";
import { mergeCoordinationTerminalMemberPubkeys } from "@/app/features/groups/services/community-participant-display-read-model";
import { useCoordinationMembershipDirectory } from "@/app/features/groups/hooks/use-coordination-membership-directory";
import { refreshCommunityMembershipTruth } from "@/app/features/groups/services/community-membership-truth";
import { attemptManagedWorkspaceCoordinationSelfHeal } from "@/app/features/groups/services/managed-workspace-coordination-self-heal";
import { assertWorkspaceCommunityJoinAllowed, useWorkspaceCommunityTrustGate, } from "@/app/features/groups/hooks/use-workspace-community-trust-gate";
import { ensureWorkspaceMembershipSyncMode } from "@/app/features/groups/services/community-workspace-membership";
import { useCommunityMembershipHealth } from "@/app/features/groups/hooks/use-community-membership-health";
import { resolveCoordinationDirectoryForMemberHealth } from "@/app/features/groups/services/resolve-coordination-directory-for-health";
import { useCommunityRelayPoolWritable } from "@/app/features/groups/hooks/use-community-relay-pool-writable";
import { resolveCommunityDirectoryHonestyDetail, resolveCommunityDirectoryHonestySummary, } from "@/app/features/groups/utils/community-directory-honesty-copy";
import { useDocumentPageVisible } from "@/app/features/runtime/use-document-page-visible";
import { resolveGroupHomeCascadeGate } from "@/app/features/groups/services/community-group-home-cascade-policy";
export default function GroupHomePage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const id = resolveGroupRouteToken({
        routeParam: params.id,
        queryId: searchParams.get("id"),
    });
    const router = useRouter();
    const { t } = useTranslation();
    const { createdGroups, communityKnownParticipantDirectoryByConversationId, communityRosterByConversationId, addGroup, } = useGroups();
    const { setSelectedConversation } = useMessaging();
    const { state: identityState } = useIdentity();
    const { relayPool } = useRelay();
    const { blocklist, presence, peerTrust } = useNetwork();
    const { preferences } = useAccessibilityPreferences();
    const isDesktop = useIsDesktop();
    const discoveredRelay = searchParams.get("relay");
    const forceSafeRenderMode = searchParams.get("renderMode") === "safe";
    const [isMemberListOpen, setIsMemberListOpen] = useState(false);
    const [provisionalOverlayEpoch, setProvisionalOverlayEpoch] = useState(0);
    const [isInviteConnectionsOpen, setIsInviteConnectionsOpen] = useState(false);
    const [isManagementOpen, setIsManagementOpen] = useState(false);
    const [managementInitialTab, setManagementInitialTab] = useState<GroupManagementTabId | undefined>(undefined);
    const openCommunityManagement = React.useCallback((tab?: GroupManagementTabId) => {
        setManagementInitialTab(tab);
        setIsManagementOpen(true);
    }, []);
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
    const directorySelfHealAttemptKeyRef = React.useRef<string | null>(null);
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
    const communityRelayUrlWritable = React.useMemo(() => hasWritableCommunityRelayTransport(effectiveRelay), [effectiveRelay]);
    const communityRelayTransportReady = communityRelayUrlWritable;
    const routeCommunityIdFallback = React.useMemo(() => {
        const routeToken = (id ?? "").trim();
        if (!routeToken.startsWith("community:")) {
            return undefined;
        }
        const communityId = routeToken.slice("community:".length).trim();
        return communityId.length > 0 ? communityId : undefined;
    }, [id]);
    const { resolvedCommunityId, communityIdCandidates, joinEvidenceMemberPubkeys, } = React.useMemo(() => buildManagedWorkspaceRosterRepairContext({
        group,
        publicKeyHex: localMemberPubkey,
        routeCommunityIdFallback,
    }), [group, localMemberPubkey, routeCommunityIdFallback]);
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
    const isGuest = !group;
    React.useEffect(() => {
        if (typeof navigator === "undefined") {
            return;
        }
        const hardwareConcurrency = typeof navigator.hardwareConcurrency === "number"
            ? navigator.hardwareConcurrency
            : null;
        const deviceMemoryGb = typeof (navigator as Navigator & {
            deviceMemory?: number;
        }).deviceMemory === "number"
            ? (navigator as Navigator & {
                deviceMemory: number;
            }).deviceMemory
            : null;
        const constrained = ((typeof hardwareConcurrency === "number" && hardwareConcurrency <= 4)
            || (typeof deviceMemoryGb === "number" && deviceMemoryGb <= 4));
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
    const seededMemberEvidence = React.useMemo(() => getResolvedClientGateway().communityRoster.resolveSeedMemberPubkeysFromDirectory({
        directory: communityKnownParticipantDirectory ?? null,
        persistedGroupMemberPubkeys: group?.memberPubkeys,
        projectionMemberPubkeys,
        localMemberPubkey,
    }), [communityKnownParticipantDirectory, group?.memberPubkeys, localMemberPubkey, projectionMemberPubkeys]);
    // Path B B1-3: canonical sealed-community instance for `/groups/[id]` (main-shell disabled on this route).
    const sealedCommunityShellEnabled = resolveGroupHomeSealedCommunityEnabled({
        hasCommunityContext: !!(group || discoveredRelay),
        hasRelayTransport: communityRelayTransportReady,
    });
    const groupThreadRelayIngestEnabled = resolveGroupHomeGroupThreadRelayIngestEnabled({
        hasCommunityContext: !!(group || discoveredRelay),
        hasRelayTransport: communityRelayTransportReady,
    });
    const sealedCommunityController = useLegacySealedCommunity({
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
    const { state: groupState, updateMetadata, requestJoin: requestJoinNip29, refresh: refreshCommunityMembership, clearLocalTerminalMembershipEvidence, applyCoordinationSemanticMemberEvent, } = sealedCommunityController;
    const resolvedGroupId = React.useMemo(() => {
        const metadataGroupId = groupState.metadata?.id?.trim() ?? "";
        if (metadataGroupId.length > 0) {
            return metadataGroupId;
        }
        return group?.groupId ?? fallbackGroupIdFromRoute;
    }, [fallbackGroupIdFromRoute, group?.groupId, groupState.metadata?.id]);
    const {
        relayActivationSynced: communityRelayActivationSynced,
    } = useCommunityRelayPoolWritable(
        effectiveRelay,
        relayPool,
        pageVisible && Boolean(group || fallbackGroupIdFromRoute),
    );
    const effectiveCommunityMode = React.useMemo(() => resolveEffectiveCommunityMode(group?.communityMode, effectiveRelay), [effectiveRelay, group?.communityMode]);
    const coordinationMembershipDirectory = useCoordinationMembershipDirectory(resolvedCommunityId);
    const coordinationDirectoryForHealth = React.useMemo(() => (
        resolveCoordinationDirectoryForMemberHealth({
            communityId: resolvedCommunityId,
            communityIdCandidates,
            localMemberPubkey,
            primaryDirectory: coordinationMembershipDirectory,
        })
    ), [
        communityIdCandidates,
        coordinationMembershipDirectory,
        localMemberPubkey,
        resolvedCommunityId,
    ]);
    const membershipHealthState = useCommunityMembershipHealth({
        communityId: resolvedCommunityId,
        communityMode: effectiveCommunityMode,
        relayUrl: effectiveRelay,
        localMemberPubkey,
        localPrivateKeyHex: identityState.privateKeyHex || null,
        accountPublicKeyHex: localMemberPubkey,
        coordinationDirectory: coordinationDirectoryForHealth,
        relayActivationSynced: communityRelayActivationSynced,
        groupIdCandidates: [
            group?.groupId ?? "",
            fallbackGroupIdFromRoute,
            group?.groupId ?? id ?? "",
        ],
        enabled: Boolean(group || fallbackGroupIdFromRoute || id),
    });
    const { health: membershipHealth, roomKeyHex } = membershipHealthState;
    const handleOpenInviteConnections = React.useCallback((): void => {
        setIsInviteConnectionsOpen(true);
    }, []);
    const groupHomeCascadeGate = React.useMemo(() => resolveGroupHomeCascadeGate({
        pageVisible,
        hasCommunityContext: Boolean(group || discoveredRelay),
        workspaceKernelAuthority: isWorkspaceKernelAuthority(),
        communityMode: effectiveCommunityMode,
    }), [
        discoveredRelay,
        effectiveCommunityMode,
        group,
        pageVisible,
    ]);
    const groupHomeHeavySideEffectsEnabled = groupHomeCascadeGate.heavySideEffectsEnabled;
    const groupHomeDirectoryRecoveryEnabled = groupHomeCascadeGate.directoryRecoveryEnabled;
    const lastCascadeGateLogRef = React.useRef<string | null>(null);
    React.useEffect(() => {
        if (!pageVisible || !resolvedCommunityId?.trim()) {
            return;
        }
        const signature = [
            groupHomeHeavySideEffectsEnabled ? "open" : "blocked",
            membershipHealth.ready ? "ready" : "not-ready",
            membershipHealth.blockers.join(","),
            resolvedCommunityId,
        ].join("|");
        if (lastCascadeGateLogRef.current === signature) {
            return;
        }
        lastCascadeGateLogRef.current = signature;
        logAppEvent({
            name: groupHomeHeavySideEffectsEnabled
                ? "groups.page.cascade_gate_open"
                : "groups.page.cascade_gate_blocked",
            level: groupHomeHeavySideEffectsEnabled ? "info" : "warn",
            scope: { feature: "groups", action: "cascade_gate" },
            context: {
                communityId: resolvedCommunityId,
                healthReady: membershipHealth.ready,
                blockers: membershipHealth.blockers.join(","),
            },
        });
    }, [
        groupHomeHeavySideEffectsEnabled,
        membershipHealth.blockers,
        membershipHealth.ready,
        pageVisible,
        resolvedCommunityId,
    ]);
    useGroupThreadRelayIngest({
        pool: relayPool,
        relayUrl: effectiveRelay,
        groupId: group?.groupId || id || "",
        communityId: group?.communityId,
        communityMode: group?.communityMode,
        myPublicKeyHex: identityState.publicKeyHex || null,
        myPrivateKeyHex: identityState.privateKeyHex || null,
        groupIdCandidates: [
            group?.groupId ?? "",
            fallbackGroupIdFromRoute,
            group?.groupId ?? id ?? "",
        ],
        activeMemberPubkeys: coordinationDirectoryForHealth?.activeMemberPubkeys,
        enabled: groupThreadRelayIngestEnabled && groupHomeHeavySideEffectsEnabled,
    });
    const { activeProposals: activeGovernanceProposals, activeProposalCount } = useCommunityGovernanceProjection({
        groupId: group?.groupId || id || "",
        communityId: group?.communityId,
        enabled: sealedCommunityShellEnabled && groupHomeHeavySideEffectsEnabled,
    });
    const relayList = useRelayList({ publicKeyHex: identityState.publicKeyHex || null });
    const { blocked: guestJoinBlocked, trust: guestJoinTrust } = useWorkspaceCommunityTrustGate({
        communityRelayUrl: effectiveRelay,
        active: isGuest && effectiveRelay.length > 0,
    });
    const handleGuestJoin = React.useCallback(async (): Promise<void> => {
        if (!effectiveRelay) {
            toast.error(t("groups.home.toast.chooseRelayBeforeJoin"));
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
    const membershipEvidenceUiContext = React.useMemo((): MembershipEvidenceUiContext => ({ membershipSyncMode }), [membershipSyncMode]);
    const directoryHonesty = React.useMemo(() => resolveCommunityDirectoryMaterializationHonesty({
        communityMode: groupState.metadata?.communityMode ?? group?.communityMode,
        relayCapabilityTier: assessRelayCapability({
            enabledRelayUrls: relayList.state.relays.map((relay) => relay.url),
            selectedRelayHost: effectiveRelay,
        }).tier,
        membershipSyncMode,
    }), [
        effectiveRelay,
        group?.communityMode,
        groupState.metadata?.communityMode,
        membershipSyncMode,
        relayList.state.relays,
    ]);
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
            chatState: messagingChatStateReadPort.load(localMemberPubkey),
            conversationId: group.id,
        });
    }, [group?.id, localMemberPubkey]);
    const rawLeftMemberPubkeys = React.useMemo(() => mergeTerminalMemberPubkeys(terminalMembershipCache?.leftMemberPubkeys ?? [], groupState.leftMembers), [groupState.leftMembers, terminalMembershipCache]);
    const rawExpelledMemberPubkeys = React.useMemo(() => mergeTerminalMemberPubkeys(terminalMembershipCache?.expelledMemberPubkeys ?? [], groupState.expelledMembers), [groupState.expelledMembers, terminalMembershipCache]);
    const { activeMemberPubkeys: activeMembers, authorEvidencePubkeys: conversationAuthorPubkeys } = React.useMemo(() => {
        if (isWorkspaceKernelAuthority()) {
            const kernelActive = resolveWorkspaceKernelActiveMemberPubkeys({
                rosterProjection: communityRosterProjection,
            }).filter((pubkey) => {
                const normalized = pubkey.trim().toLowerCase();
                return normalized.length > 0
                    && !rawLeftMemberPubkeys.some((left) => left.trim().toLowerCase() === normalized)
                    && !rawExpelledMemberPubkeys.some((expelled) => expelled.trim().toLowerCase() === normalized);
            });
            return {
                activeMemberPubkeys: kernelActive,
                authorEvidencePubkeys: Array.from(new Set([
                    ...kernelActive,
                    ...persistedConversationAuthorPubkeys,
                ])) as ReadonlyArray<PublicKeyHex>,
            };
        }
        return getResolvedClientGateway().communityRoster.resolveActiveMemberPubkeysFromConversation({
            communityMessages: groupState.messages ?? [],
            persistedMessageAuthorPubkeys: persistedConversationAuthorPubkeys,
            seededMemberPubkeys: seededMemberEvidence,
            projectionMemberPubkeys,
            localMemberPubkey,
            leftMemberPubkeys: rawLeftMemberPubkeys,
            expelledMemberPubkeys: rawExpelledMemberPubkeys,
        });
    }, [
        communityRosterProjection,
        rawExpelledMemberPubkeys,
        rawLeftMemberPubkeys,
        groupState.messages,
        localMemberPubkey,
        persistedConversationAuthorPubkeys,
        projectionMemberPubkeys,
        seededMemberEvidence,
    ]);
    const activeMembersFingerprint = React.useMemo(() => activeMembers.join(","), [activeMembers]);
    const conversationAuthorPubkeysFingerprint = React.useMemo(() => conversationAuthorPubkeys.join(","), [conversationAuthorPubkeys]);
    const rawLeftMemberPubkeysFingerprint = React.useMemo(() => rawLeftMemberPubkeys.join(","), [rawLeftMemberPubkeys]);
    const rawExpelledMemberPubkeysFingerprint = React.useMemo(() => rawExpelledMemberPubkeys.join(","), [rawExpelledMemberPubkeys]);
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
    const effectiveActiveMembers = React.useMemo(() => Array.from(new Set([...activeMembers, ...provisionalMemberPubkeys])) as ReadonlyArray<PublicKeyHex>, [activeMembers, provisionalMemberPubkeys]);
    const rosterLeftMemberPubkeys = React.useMemo(() => mergeCoordinationTerminalMemberPubkeys(rawLeftMemberPubkeys, coordinationMembershipDirectory, "left"), [coordinationMembershipDirectory, rawLeftMemberPubkeys]);
    const rosterExpelledMemberPubkeys = React.useMemo(() => mergeCoordinationTerminalMemberPubkeys(rawExpelledMemberPubkeys, coordinationMembershipDirectory, "expelled"), [coordinationMembershipDirectory, rawExpelledMemberPubkeys]);
    const relayEvidenceConfidence = (groupState as {
        relayEvidenceRef?: {
            confidenceLevel: "seed_only" | "warming_up" | "partial_eose" | "steady_state";
        };
    }).relayEvidenceRef?.confidenceLevel ?? "seed_only";
    const directoryParticipantPubkeys = React.useMemo(() => (knownParticipantPubkeys ?? []) as ReadonlyArray<PublicKeyHex>, [knownParticipantPubkeys]);
    const {
        participantDisplayPubkeys,
        authorEvidencePubkeys,
        inviteBlocklistPubkeys: kernelInviteBlocklistPubkeys,
        usesKernelRoster,
    } = useGroupHomeParticipantPubkeys({
        conversationId: group?.id ?? "",
        communityId: resolvedCommunityId,
        communityMode: effectiveCommunityMode,
        relayUrl: effectiveRelay,
        coordinationDirectory: coordinationMembershipDirectory,
        directoryParticipantPubkeys,
        persistedGroupMemberPubkeys: (group?.memberPubkeys ?? []) as ReadonlyArray<PublicKeyHex>,
        projectionMemberPubkeys,
        rosterSeedPubkeys: seededMemberEvidence,
        communityMessages: groupState.messages ?? [],
        localMemberPubkey,
        leftMemberPubkeys: rosterLeftMemberPubkeys,
        expelledMemberPubkeys: rosterExpelledMemberPubkeys,
        joinEvidenceMemberPubkeys,
        relayEvidenceConfidence,
        persistedEvidenceOwnerPubkey: localMemberPubkey,
        ledgerGroupId: group?.groupId,
        ledgerRelayUrl: group?.relayUrl,
    });
    const inviteEligibleMemberPubkeys = React.useMemo(() => (
        usesKernelRoster
            ? kernelInviteBlocklistPubkeys
            : resolveCommunityInviteMemberBlocklist({
                communityMode: effectiveCommunityMode,
                relayUrl: effectiveRelay,
                coordinationDirectory: coordinationMembershipDirectory,
                hybridActiveMemberPubkeys: effectiveActiveMembers,
                joinEvidenceMemberPubkeys,
                knownParticipantPubkeys: directoryParticipantPubkeys,
                participationAuthorPubkeys: authorEvidencePubkeys,
                leftMemberPubkeys: rawLeftMemberPubkeys,
                expelledMemberPubkeys: rawExpelledMemberPubkeys,
            })
    ), [
        authorEvidencePubkeys,
        coordinationMembershipDirectory,
        directoryParticipantPubkeys,
        effectiveActiveMembers,
        effectiveCommunityMode,
        effectiveRelay,
        joinEvidenceMemberPubkeys,
        kernelInviteBlocklistPubkeys,
        rawExpelledMemberPubkeys,
        rawLeftMemberPubkeys,
        usesKernelRoster,
    ]);

    useEffect(() => {
        const groupId = group?.groupId || id || "";
        if (!groupId || !effectiveRelay || !pageVisible || !groupHomeHeavySideEffectsEnabled) {
            return;
        }
        const profileId = getResolvedProfileId();
        const terminalChanged = stripTerminalCommunityMembersWithActiveEvidence({
            groupId,
            relayUrl: effectiveRelay,
            profileId,
            relayBackedMemberPubkeys: activeMembers,
            conversationAuthorPubkeys,
            protectedTerminalMemberPubkeys: mergeTerminalMemberPubkeys(rawLeftMemberPubkeys, rawExpelledMemberPubkeys),
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
        groupHomeHeavySideEffectsEnabled,
    ]);
    const refreshCommunityMembershipRef = useRef(refreshCommunityMembership);
    refreshCommunityMembershipRef.current = refreshCommunityMembership;
    useEffect(() => {
        const groupId = group?.groupId || id || "";
        if (!groupId || !effectiveRelay || !communityRelayTransportReady || !pageVisible || !groupHomeHeavySideEffectsEnabled) {
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
    }, [communityRelayTransportReady, effectiveRelay, group?.groupId, groupHomeHeavySideEffectsEnabled, id, pageVisible]);
    React.useEffect(() => {
        if (!pageVisible || !isWorkspaceKernelAuthority() || !resolvedCommunityId?.trim() || !groupHomeDirectoryRecoveryEnabled) {
            return;
        }
        void refreshCommunityMembershipTruth({
            communityId: resolvedCommunityId,
            communityMode: effectiveCommunityMode,
            localMemberPubkey,
            forceFull: true,
        });
    }, [
        effectiveCommunityMode,
        groupHomeDirectoryRecoveryEnabled,
        localMemberPubkey,
        pageVisible,
        resolvedCommunityId,
    ]);
    React.useEffect(() => {
        if (!pageVisible || !groupHomeDirectoryRecoveryEnabled) {
            return;
        }
        if (!membershipHealth.blockers.includes("coordination_missing_peer")) {
            return;
        }
        const groupId = group?.groupId || id || "";
        if (!groupId || !effectiveRelay || !resolvedCommunityId?.trim() || !localMemberPubkey || !identityState.privateKeyHex) {
            return;
        }
        const attemptKey = `${resolvedCommunityId}|${localMemberPubkey.trim().toLowerCase()}`;
        if (directorySelfHealAttemptKeyRef.current === attemptKey) {
            return;
        }
        directorySelfHealAttemptKeyRef.current = attemptKey;
        void attemptManagedWorkspaceCoordinationSelfHeal({
            groupId,
            relayUrl: effectiveRelay,
            communityId: resolvedCommunityId,
            communityIdCandidates,
            communityMode: effectiveCommunityMode,
            localMemberPubkey,
            actorPrivateKeyHex: identityState.privateKeyHex,
        }).then((result) => {
            if (!result.healed) {
                return;
            }
            void refreshCommunityMembershipTruth({
                communityId: resolvedCommunityId,
                communityMode: effectiveCommunityMode,
                localMemberPubkey,
                forceFull: true,
            });
        });
    }, [
        communityIdCandidates,
        effectiveCommunityMode,
        effectiveRelay,
        group?.groupId,
        groupHomeDirectoryRecoveryEnabled,
        id,
        identityState.privateKeyHex,
        localMemberPubkey,
        membershipHealth.blockers,
        pageVisible,
        resolvedCommunityId,
    ]);
    /** Participant list: kernel coordination truth (W3) or legacy monotonic roster. */
    const visibleMembers = React.useMemo(() => filterVisibleGroupMembers(participantDisplayPubkeys, (pubkey) => discoveryCache.getProfile(pubkey)), [participantDisplayPubkeys]);
    const terminalParticipantSet = React.useMemo(() => new Set([
        ...rosterLeftMemberPubkeys,
        ...rosterExpelledMemberPubkeys,
    ].map((pubkey) => pubkey.trim().toLowerCase())), [rosterExpelledMemberPubkeys, rosterLeftMemberPubkeys]);
    const activeVisibleMembers = React.useMemo(() => visibleMembers.filter((pubkey) => !terminalParticipantSet.has(pubkey.trim().toLowerCase())), [terminalParticipantSet, visibleMembers]);
    const provisionalVisibleCount = React.useMemo(() => activeVisibleMembers.filter((pk) => (resolveCommunityMemberEvidenceTier(pk, {
        activeMemberPubkeys: activeMembers,
        provisionalMemberPubkeys,
    }) === "provisional")).length, [activeMembers, activeVisibleMembers, provisionalMemberPubkeys]);
    const terminalRecordCount = React.useMemo(() => new Set([...rawLeftMemberPubkeys, ...rawExpelledMemberPubkeys]).size, [rawExpelledMemberPubkeys, rawLeftMemberPubkeys]);
    const displayMemberCount = activeVisibleMembers.length;
    const terminalMemberEntries = React.useMemo(() => {
        const leftSet = new Set(rawLeftMemberPubkeys.map((pk) => pk.trim().toLowerCase()));
        return [
            ...rawLeftMemberPubkeys.map((pubkey) => ({ pubkey, kind: "left" as const })),
            ...rawExpelledMemberPubkeys
                .filter((pubkey) => !leftSet.has(pubkey.trim().toLowerCase()))
                .map((pubkey) => ({ pubkey, kind: "expelled" as const })),
        ] as ReadonlyArray<Readonly<{
            pubkey: PublicKeyHex;
            kind: CommunityTerminalMemberKind;
        }>>;
    }, [rawExpelledMemberPubkeys, rawLeftMemberPubkeys]);
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
            participantDisplayPubkeys.length,
            activeVisibleMembers.length,
            groupState.membership.status,
        ].join("|");
        if (lastParticipantProjectionSignatureRef.current === signature) {
            return;
        }
        lastParticipantProjectionSignatureRef.current = signature;
        const visibleShrankBelowStable = false;
        const projectionThinnerThanKnown = (projectionMemberPubkeys?.length ?? 0) < (knownParticipantPubkeys?.length ?? 0);
        const projectionThinnerThanAuthors = (projectionMemberPubkeys?.length ?? 0) < authorEvidencePubkeys.length;
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
                stableParticipantCount: participantDisplayPubkeys.length,
                visibleParticipantCount: activeVisibleMembers.length,
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
        projectionMemberPubkeys?.length,
        provisionalMemberPubkeys.length,
        participantDisplayPubkeys.length,
    ]);
    React.useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }
        if (group) {
            return;
        }
        if (!effectiveRelay || !resolvedGroupId || !groupHomeHeavySideEffectsEnabled) {
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
        const materializeRouteKey = `${resolvedGroupId}|${effectiveRelay}|${resolvedCommunityId ?? ""}`;
        if (materializedGuestRouteKeyRef.current === materializeRouteKey) {
            return;
        }
        let cancelled = false;
        void (async () => {
            const profileId = getResolvedProfileId();
            if (isGroupTombstoned(myPublicKeyHex, { groupId: resolvedGroupId, relayUrl: effectiveRelay }, { profileId })) {
                return;
            }
            const { roomKeyStore } = await import("@/app/features/crypto/room-key-store");
            const roomKeyHex = (await roomKeyStore.getRoomKey(resolvedGroupId))?.trim() ?? "";
            if (isWorkspaceKernelAuthority()) {
                if (!roomKeyHex) {
                    return;
                }
            }
            if (cancelled) {
                return;
            }
            materializedGuestRouteKeyRef.current = materializeRouteKey;
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
                addGroup(materializedGroup, { allowRevive: true, relayConfirmed: true });
                dispatchGroupInviteReceived(materializedGroup);
                dispatchGroupMembershipConfirmed(membershipConfirmedDetail);
            });
        })();
        return () => {
            cancelled = true;
        };
    }, [
        addGroup,
        communityRelayActivationSynced,
        communityRelayTransportReady,
        effectiveActiveMembers,
        effectiveRelay,
        group,
        groupHomeHeavySideEffectsEnabled,
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
        if (!group) {
            return;
        }
        setSelectedConversation(group);
        router.push(`/?convId=${encodeURIComponent(group.id)}`);
    }, [group, router, setSelectedConversation]);
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const notificationPreferenceProfileId = getResolvedProfileId();
    React.useEffect(() => {
        if (!group && !resolvedGroupId) {
            return;
        }
        setNotificationsEnabled(group
            ? isConversationNotificationsEnabled(group, notificationPreferenceProfileId)
            : true);
    }, [
        group,
        notificationPreferenceProfileId,
        resolvedGroupId,
    ]);
    const toggleNotifications = () => {
        const next = !notificationsEnabled;
        setNotificationsEnabled(next);
        if (group) {
            setConversationNotificationsEnabled({
                conversation: group,
                enabled: next,
                profileId: getResolvedProfileId(),
            });
            toast.success(next ? t("groups.home.toast.notificationsEnabled") : t("groups.home.toast.notificationsDisabled"));
        }
    };
    const handleToggleBlock = () => {
        const identifier = group?.groupId || id || "";
        if (blocklist.state.blockedPublicKeys.includes(identifier as any)) {
            blocklist.removeBlocked({ publicKeyHex: identifier as any });
            toast.success(t("groups.home.toast.unblocked"));
        }
        else {
            blocklist.addBlocked({ publicKeyInput: identifier });
            toast.success(t("groups.home.toast.blocked"));
        }
    };
    const isBlocked = blocklist?.state?.blockedPublicKeys?.includes((group?.groupId || id || "") as any) ?? false;
    const openMemberList = (): void => {
        setIsMemberListOpen(true);
    };
    useEffect(() => {
        if (!isMemberListOpen) {
            return;
        }
        const candidates = communityIdCandidates.length > 0
            ? communityIdCandidates
            : [(resolvedCommunityId ?? group?.groupId ?? id ?? "").trim()].filter(Boolean);
        if (candidates.length === 0) {
            return;
        }
        void Promise.all(candidates.map((communityId) => (refreshCommunityMembershipTruth({
            communityId,
            communityMode: group?.communityMode ?? groupState.metadata?.communityMode,
            localMemberPubkey,
            forceFull: true,
        }))));
    }, [
        communityIdCandidates,
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
    };
    const handleReconcileMembership = React.useCallback(async (options?: Readonly<{
        silent?: boolean;
    }>) => {
        const groupId = group?.groupId || id || "";
        if (!groupId || !effectiveRelay) {
            if (!options?.silent) {
                toast.error(t("groups.home.toast.reconcileMissingDetails"));
            }
            return;
        }
        const communityMode = resolveEffectiveCommunityMode(groupState.metadata?.communityMode ?? group?.communityMode, effectiveRelay);
        const outcome = await reconcileWorkspaceMembershipEvidence({
            groupId,
            relayUrl: effectiveRelay,
            profileId: getResolvedProfileId(),
            communityId: resolvedCommunityId,
            communityIdCandidates,
            communityMode,
            localMemberPubkey: localMemberPubkey ?? undefined,
            actorPrivateKeyHex: identityState.privateKeyHex ?? undefined,
            refreshRelaySubscription: refreshCommunityMembership,
            onSemanticMemberEvent: usesCoordinationMembershipDirectory(communityMode, effectiveRelay)
                ? applyCoordinationSemanticMemberEvent
                : undefined,
        });
        setProvisionalOverlayEpoch((e) => e + 1);
        if (options?.silent) {
            return;
        }
        if (outcome.coordination && !outcome.coordination.ok) {
            toast.error(t("groups.membershipEvidence.reconcileCoordinationFailed"));
            return;
        }
        const coordinationApplied = outcome.coordination?.appliedDeltaCount ?? 0;
        toast.success(outcome.coordination
            ? t("groups.membershipEvidence.reconcileToastCoordination", { count: coordinationApplied })
            : t("groups.membershipEvidence.reconcileToast"));
    }, [
        applyCoordinationSemanticMemberEvent,
        communityIdCandidates,
        effectiveRelay,
        group?.communityMode,
        group?.groupId,
        groupState.metadata?.communityMode,
        id,
        identityState.privateKeyHex,
        localMemberPubkey,
        refreshCommunityMembership,
        resolvedCommunityId,
        t,
    ]);
    const refreshMembershipForInviteOpen = React.useCallback(() => handleReconcileMembership({ silent: true }), [handleReconcileMembership]);
    const handleClearTerminalMembership = React.useCallback(() => {
        const groupId = group?.groupId || id || "";
        if (!groupId || !effectiveRelay) {
            toast.error(t("groups.home.toast.clearTerminalMissingDetails"));
            return;
        }
        clearCommunityTerminalMembershipEvidence({
            groupId,
            relayUrl: effectiveRelay,
            clearLocalTerminalMembershipEvidence,
            refreshRelaySubscription: refreshCommunityMembership,
        });
        toast.success(t("groups.membershipEvidence.clearTerminalToast"));
    }, [clearLocalTerminalMembershipEvidence, effectiveRelay, group?.groupId, id, refreshCommunityMembership, t]);
    const displayName = resolveCommunityDisplayName({
        metadataName: groupState.metadata?.name,
        persistedDisplayName: group?.displayName,
        groupId: resolvedGroupId,
        communityId: resolvedCommunityId,
        fallback: t("groups.communityLabel"),
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
                ?? t("groups.personalControls.thisProfile");
        }
        catch {
            return t("groups.personalControls.thisProfile");
        }
    }, [t]);
    const handleDeleteCommunity = () => {
        if (!groupActionRouteParams.routeToken) {
            toast.error(t("groups.deleteCommunityMissingDetails"));
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
            toast.error(t("groups.home.toast.blockMissingDetails"));
            return;
        }
        router.push(buildGroupBlockHref(groupActionRouteParams));
    };
    const aboutText = groupState.metadata?.about || group?.about || t("groups.home.defaultAbout");
    const avatarUrl = groupState.metadata?.picture || group?.avatar;
    const relayScopeMismatchCount = groupState.relayFeedback.rejectionStats?.relayScopeMismatch ?? 0;
    const isRelayDegraded = relayScopeMismatchCount > 0 || Boolean(groupState.relayFeedback.lastNotice);
    const relayStatusLabel = isRelayDegraded ? t("groups.home.relay.statusDegraded") : t("groups.home.relay.statusConnected");
    const relayStatusDetail = isRelayDegraded
        ? (relayScopeMismatchCount > 0
            ? t("groups.home.relay.statusDetailOutOfScope", { count: relayScopeMismatchCount })
            : (groupState.relayFeedback.lastNotice ?? t("groups.home.relay.statusDetailFiltered")))
        : t("groups.home.relay.statusDetailNormal");
    const communityAccessMode = groupState.metadata?.access || "open";
    const communityAccessModeLabel = t(`groups.home.accessMode.${communityAccessMode}`);
    const directoryHonestySummary = resolveCommunityDirectoryHonestySummary(directoryHonesty, t);
    const directoryHonestyDetail = resolveCommunityDirectoryHonestyDetail(directoryHonesty, t);
    const rosterEvidenceHeaderExtras = (<>
            <CommunityLegacySovereignNotice communityMode={group?.communityMode ?? groupState.metadata?.communityMode} relayUrl={effectiveRelay} className="w-full max-w-2xl"/>
            {!directoryHonesty.claimsAuthoritativeDirectory ? (<CommunityDirectoryHonestyNotice honesty={directoryHonesty} className="w-full max-w-2xl"/>) : null}
            {provisionalVisibleCount > 0 ? (<div className="flex items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/10 px-4 py-1.5 dark:border-amber-500/30 dark:bg-amber-500/10">
                    <span className="text-[11px] font-black uppercase tracking-widest text-amber-800 dark:text-amber-200">
                        {t("groups.membershipEvidence.heroProvisional", { count: provisionalVisibleCount })}
                    </span>
                </div>) : null}
            {terminalRecordCount > 0 ? (<div className="flex items-center gap-2 rounded-full border border-zinc-400/25 bg-zinc-500/10 px-4 py-1.5 dark:border-zinc-600/40 dark:bg-zinc-800/50">
                    <span className="text-[11px] font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-300">
                        {t("groups.membershipEvidence.heroTerminal", { count: terminalRecordCount })}
                    </span>
                </div>) : null}
        </>);
    if (!group && !discoveredRelay) {
        return (<PageShell title={t("groups.home.notFound.title")}>
                <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
                    <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-[24px] border border-black/10 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900">
                        <Users className="h-10 w-10 text-zinc-500 dark:text-zinc-600"/>
                    </div>
                    <h1 className="mb-2 text-3xl font-black text-zinc-900 dark:text-white">{t("groups.home.notFound.heading")}</h1>
                    <p className="mb-8 max-w-sm text-zinc-600 dark:text-zinc-500">{t("groups.home.notFound.body")}</p>
                    <Button onClick={() => router.push("/network")} variant="secondary" className="rounded-xl px-8 font-black">
                        {t("groups.home.backToNetwork")}
                    </Button>
                </div>
            </PageShell>);
    }
    return (<PageShell title={displayName}>
            <div className={cn("mx-auto w-full px-4 sm:px-6", compact ? "max-w-3xl pt-0 pb-28 space-y-3" : tablet ? "max-w-3xl pt-4 pb-28 space-y-6" : "max-w-5xl pt-20 pb-20 md:pb-0 space-y-12", safeVisualMode ? "opacity-100" : "animate-in fade-in slide-in-from-bottom-4 duration-700")}>
                {/* Back Button */}
                <div className={compact ? undefined : "pt-6"}>
                    <button onClick={() => router.push("/network")} className="group flex items-center gap-2 text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-white">
                        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1"/>
                        <span className="text-xs font-black uppercase tracking-widest">{t("groups.home.backToNetwork")}</span>
                    </button>
                </div>

                {activeProposalCount > 0 && (<button type="button" onClick={() => openCommunityManagement("governance")} className="w-full rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-left text-sm text-amber-950 transition-colors hover:bg-amber-500/15 dark:text-amber-100 dark:hover:bg-amber-500/20">
                        <p className="font-semibold">
                            {activeProposalCount === 1
                ? t("groups.home.governanceBanner.single")
                : t("groups.home.governanceBanner.multiple", { count: activeProposalCount })}
                        </p>
                        <p className="mt-1 text-xs opacity-90">
                            {t("groups.home.governanceBanner.hint")}
                        </p>
                    </button>)}

                {/* Immersive Hero Section */}
                <div className="relative group/hero">
                    {/* Background Ambient Glow */}
                    {!safeVisualMode && (<>
                            <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full animate-pulse pointer-events-none"/>
                            <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full animate-pulse pointer-events-none delay-700"/>
                        </>)}

                    <Card className={cn("relative overflow-hidden shadow-2xl", compact ? "rounded-2xl p-5 shadow-lg" : "rounded-[48px] p-8 sm:p-12", safeVisualMode
            ? "border-black/10 bg-white/95 dark:border-white/[0.05] dark:bg-[#0C0C0E]/95"
            : "border-black/10 bg-white/75 backdrop-blur-xl dark:border-white/[0.03] dark:bg-[#0C0C0E]/80")}>
                        {!compact ? (<div className="absolute inset-0 z-0 opacity-10 pointer-events-none overflow-hidden">
                            {avatarUrl ? (<Image src={avatarUrl} alt="" fill className={cn("object-cover", safeVisualMode ? "blur-sm scale-110" : "blur-3xl scale-150")}/>) : (<div className={cn("absolute inset-0 bg-gradient-to-br from-purple-500/20 to-indigo-600/20", safeVisualMode ? "blur-sm" : "blur-3xl")}/>)}
                        </div>) : null}

                        <div className={cn("relative z-10 flex flex-col items-center md:items-start", compact ? "gap-5 text-center" : "md:flex-row gap-10 md:gap-14")}>
                            {/* Avatar with Status Ring */}
                            <div className="relative shrink-0">
                                {safeVisualMode ? (<div className={cn("relative bg-gradient-to-br from-purple-500 to-indigo-600 shadow-2xl", compact ? "rounded-2xl p-1" : "rounded-[48px] p-1.5")}>
                                        <Avatar className={cn("border-[6px] border-black/20 shadow-xl dark:border-[#0C0C0E]", compact ? "h-28 w-28 rounded-xl" : "h-44 w-44 rounded-[42px]")}>
                                            <AvatarImage src={avatarUrl} className="object-cover"/>
                                            <AvatarFallback className={cn("bg-zinc-100 font-black text-zinc-900 dark:bg-[#1A1A1E] dark:text-white", compact ? "text-4xl" : "text-6xl")}>
                                                {displayName.slice(0, 1).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="absolute -bottom-2 -right-2 flex h-10 w-10 items-center justify-center rounded-2xl border-[6px] border-black/20 bg-green-500 shadow-lg dark:border-[#0C0C0E]">
                                            <div className="h-2.5 w-2.5 rounded-full bg-white"/>
                                        </div>
                                    </div>) : (<motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.5, ease: "easeOut" }} className={cn("relative bg-gradient-to-br from-purple-500 to-indigo-600 shadow-2xl", compact ? "rounded-2xl p-1" : "rounded-[48px] p-1.5")}>
                                        <Avatar className={cn("border-[6px] border-black/20 shadow-xl dark:border-[#0C0C0E]", compact ? "h-28 w-28 rounded-xl" : "h-44 w-44 rounded-[42px]")}>
                                            <AvatarImage src={avatarUrl} className="object-cover"/>
                                            <AvatarFallback className={cn("bg-zinc-100 font-black text-zinc-900 dark:bg-[#1A1A1E] dark:text-white", compact ? "text-4xl" : "text-6xl")}>
                                                {displayName.slice(0, 1).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="absolute -bottom-2 -right-2 flex h-10 w-10 items-center justify-center rounded-2xl border-[6px] border-black/20 bg-green-500 shadow-lg transition-transform group-hover/hero:scale-110 dark:border-[#0C0C0E]">
                                            <div className="h-2.5 w-2.5 rounded-full bg-white animate-pulse"/>
                                        </div>
                                    </motion.div>)}
                            </div>

                            {/* Main Title & Description */}
                            <div className={cn("flex-1 w-full text-center md:text-left", compact ? "space-y-4" : "space-y-8")}>
                                <div className={compact ? "space-y-2" : "space-y-4"}>
                                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                                        {safeVisualMode ? (<>
                                                <h1 className={cn("font-black tracking-tight text-zinc-950 dark:text-white", compact ? "text-3xl" : "text-5xl sm:text-6xl")}>
                                                    {displayName}
                                                </h1>
                                                <div className="flex items-center gap-2 rounded-full border border-black/10 bg-black/[0.04] px-3 py-1 dark:border-white/10 dark:bg-white/[0.05]">
                                                    <Globe className="h-3.5 w-3.5 text-purple-400"/>
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-800 dark:text-zinc-400">
                                                        {compact ? relayHostLabel : effectiveRelay.replace("wss://", "")}
                                                    </span>
                                                </div>
                                                {!compact ? rosterEvidenceHeaderExtras : null}
                                            </>) : (<>
                                                <motion.h1 initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className={cn("font-black tracking-tight text-zinc-950 dark:text-white", compact ? "text-3xl" : "text-5xl sm:text-6xl")}>
                                                    {displayName}
                                                </motion.h1>
                                                <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.4 }} className="flex items-center gap-2 rounded-full border border-black/10 bg-black/[0.04] px-3 py-1 dark:border-white/10 dark:bg-white/[0.05]">
                                                    <Globe className="h-3.5 w-3.5 text-purple-400"/>
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-800 dark:text-zinc-400">
                                                        {compact ? relayHostLabel : effectiveRelay.replace("wss://", "")}
                                                    </span>
                                                </motion.div>
                                                {!compact ? rosterEvidenceHeaderExtras : null}
                                            </>)}
                                    </div>
                                    <p className={cn("mx-auto max-w-2xl font-medium leading-relaxed text-zinc-700 dark:text-zinc-400 md:mx-0", compact ? "text-sm line-clamp-3" : "text-xl")}>
                                        {aboutText}
                                    </p>
                                </div>

                                {/* Premium Action Bar */}
                                <div className={cn("flex w-full items-center justify-center md:justify-start", compact ? "flex-col gap-2" : "flex-wrap gap-3")}>
                                    {!isGuest ? (<Button onClick={handleEnterCommunityChat} className={cn("rounded-xl border border-zinc-300 bg-white text-zinc-950 hover:bg-zinc-100 font-black shadow-lg shadow-zinc-900/5 transition-all hover:scale-[1.02] active:scale-95 gap-2 dark:border-white/10 dark:bg-white dark:text-black dark:hover:bg-zinc-200 dark:shadow-white/5", compact ? "h-11 w-full px-4 text-sm" : "h-16 px-10 rounded-2xl text-lg gap-3")}>
                                            <MessageSquare className={compact ? "h-4 w-4" : "h-6 w-6"}/>
                                            {t("groups.home.enterChat")}
                                        </Button>) : (<Button onClick={() => void handleGuestJoin()} disabled={guestJoinBlocked} title={guestJoinBlocked ? guestJoinTrust.userMessage : undefined} className={cn("rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black shadow-2xl shadow-purple-500/20 transition-all hover:scale-[1.02] active:scale-95 gap-2 disabled:opacity-50", compact ? "h-11 w-full px-4 text-sm" : "h-16 px-10 rounded-2xl text-lg gap-3")}>
                                            <UserPlus className={compact ? "h-4 w-4" : "h-6 w-6"}/>
                                            {t("groups.home.joinCommunity")}
                                        </Button>)}

                                    {!isGuest ? (compact ? (<div className="grid w-full grid-cols-2 gap-2">
                                                <Button onClick={handleOpenInviteConnections} className="h-10 gap-1.5 rounded-xl border border-zinc-300 bg-zinc-900 text-xs font-bold text-white dark:border-white/5 dark:bg-zinc-800/80">
                                                    <UserPlus className="h-4 w-4"/>
                                                    {t("groups.home.invite")}
                                                </Button>
                                                {group ? (<Button onClick={() => openCommunityManagement()} variant="outline" className="h-10 gap-1.5 rounded-xl border border-zinc-300 bg-white text-xs font-bold text-zinc-900 hover:bg-zinc-50 dark:border-white/15 dark:bg-transparent dark:text-white dark:hover:bg-white/5">
                                                        <Settings className="h-4 w-4"/>
                                                        {t("groups.home.manage")}
                                                    </Button>) : null}
                                            </div>) : (<>
                                        <Button onClick={handleOpenInviteConnections} className={cn("h-16 gap-3 rounded-2xl border border-black/10 bg-zinc-900/90 px-8 text-white transition-all hover:scale-[1.02] hover:bg-zinc-800/90 active:scale-95 dark:border-white/5 dark:bg-zinc-800/80 dark:hover:bg-zinc-700/80", safeVisualMode ? "backdrop-blur-none" : "backdrop-blur-md")}>
                                            <UserPlus className="h-5 w-5"/>
                                            {t("groups.home.invite")}
                                        </Button>

                                    {group ? (<Button onClick={() => openCommunityManagement()} variant="outline" className={cn("h-14 gap-2 rounded-2xl border border-zinc-300 bg-white px-6 font-bold text-zinc-900 transition-all hover:bg-zinc-50 active:scale-95 dark:border-white/15 dark:bg-transparent dark:text-white dark:hover:bg-white/5", safeVisualMode ? "backdrop-blur-none" : "backdrop-blur-md")}>
                                            <Settings className="h-5 w-5"/>
                                            {t("groups.home.manage")}
                                        </Button>) : null}
                                        </>)) : null}

                                    {!isGuest ? (<div className={cn("flex items-center rounded-xl border border-black/10 bg-black/[0.04] dark:border-white/5 dark:bg-white/[0.03]", compact
                ? "w-full justify-center gap-0.5 p-0.5"
                : "gap-2 rounded-2xl p-1", safeVisualMode ? "backdrop-blur-none" : "backdrop-blur-md")}>
                                        <Button variant="ghost" onClick={toggleNotifications} className={cn("rounded-lg transition-all hover:bg-black/[0.06] dark:hover:bg-white/5", compact ? "h-10 w-10" : "h-14 w-14 rounded-xl", notificationsEnabled ? "text-purple-600 dark:text-purple-400" : "text-zinc-600 dark:text-zinc-500")} aria-label={notificationsEnabled ? t("groups.home.notifications.disableAria") : t("groups.home.notifications.enableAria")}>
                                            {notificationsEnabled ? (<Bell className={compact ? "h-4 w-4" : "h-6 w-6"}/>) : (<BellOff className={compact ? "h-4 w-4" : "h-6 w-6"}/>)}
                                        </Button>

                                        <Button variant="ghost" className={cn("rounded-lg text-zinc-600 transition-all hover:bg-black/[0.06] hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white", compact ? "h-10 w-10" : "h-14 w-14 rounded-xl")} aria-label={t("groups.home.copyDiscoveryLinkAria")} onClick={() => {
                const url = toAbsoluteAppUrl(getPublicGroupHref(group?.id || id || "", effectiveRelay || undefined));
                navigator.clipboard.writeText(url);
                toast.success(t("groups.home.discoveryLinkCopied"));
            }}>
                                            <Share2 className={compact ? "h-4 w-4" : "h-6 w-6"}/>
                                        </Button>

                                        <div className={cn("bg-black/10 dark:bg-white/10", compact ? "mx-0.5 h-6 w-px" : "mx-1 h-8 w-[1px]")}/>

                                        <Button variant="ghost" onClick={() => {
                if (!groupActionRouteParams.routeToken) {
                    toast.error(t("groups.home.leaveMissingDetails"));
                    return;
                }
                router.push(buildGroupLeaveHref(groupActionRouteParams));
            }} className={cn("rounded-lg text-rose-500 hover:bg-rose-500/10 transition-all active:scale-90", compact ? "h-10 w-10 hover:scale-105" : "h-14 w-14 rounded-xl hover:scale-110")} aria-label={t("groups.home.leaveAria")}>
                                            <LogOut className={compact ? "h-4 w-4" : "h-6 w-6"}/>
                                        </Button>
                                    </div>) : null}
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Bento Grid Stats */}
                <div className={cn("grid grid-cols-1", compact ? "gap-3" : tablet ? "gap-4 sm:grid-cols-2" : "gap-6 md:grid-cols-4 lg:grid-cols-6")}>
                    {/* Membership Card - Wide */}
                    <button type="button" onClick={openMemberList} className={cn("text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60", compact ? "rounded-2xl" : "rounded-[40px]", tablet ? "sm:col-span-1" : "md:col-span-2 lg:col-span-3")}>
                        <Card className={cn("flex flex-col justify-between hover:border-purple-500/20 transition-all duration-500 group/bento overflow-hidden relative cursor-pointer", compact ? "rounded-2xl p-4" : "rounded-[40px] p-8", safeVisualMode
            ? "border-black/10 bg-white/95 dark:border-white/[0.05] dark:bg-[#0C0C0E]/90"
            : "border-black/10 bg-white/80 backdrop-blur-xl dark:border-white/[0.03] dark:bg-[#0C0C0E]/40")}>
                            {!compact ? (<div className="absolute -right-8 -bottom-8 opacity-[0.03] group-hover/bento:opacity-[0.08] transition-opacity duration-1000">
                                <Users size={240} className="text-zinc-900 dark:text-white"/>
                            </div>) : null}
                            <div className={cn("relative z-10", compact ? "space-y-3" : "space-y-6")}>
                                <div className="flex items-center justify-between">
                                    <div className={cn("rounded-2xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20", compact ? "h-10 w-10" : "h-14 w-14")}>
                                        <Users className={cn("text-purple-400", compact ? "h-5 w-5" : "h-7 w-7")}/>
                                    </div>
                                    <span className="px-3 py-1 rounded-full bg-purple-500/10 text-purple-800 text-[10px] font-black uppercase tracking-widest border border-purple-500/25 dark:text-purple-400 dark:border-purple-500/20">
                                        {t("groups.home.participants.badge")}
                                    </span>
                                </div>
                                <div className="space-y-1">
                                    <h3 className={cn("font-black text-zinc-900 dark:text-white", compact ? "text-lg" : "text-3xl")}>{t("groups.home.access.title")}</h3>
                                    {!compact ? (<p className="font-medium text-zinc-700 dark:text-zinc-500">
                                        {directoryHonesty.claimsAuthoritativeDirectory
                ? t("groups.home.access.descriptionAuthoritative")
                : directoryHonestySummary}
                                    </p>) : (<p className="text-xs text-zinc-600 dark:text-zinc-500 line-clamp-2">
                                        {directoryHonesty.claimsAuthoritativeDirectory
                ? t("groups.home.access.descriptionAuthoritativeCompact")
                : directoryHonestySummary}
                                    </p>)}
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 dark:text-zinc-500">
                                        {directoryHonesty.claimsAuthoritativeDirectory
            ? t("groups.home.access.evidenceAuthoritative")
            : t("groups.home.access.evidenceBestEffort")}
                                    </p>
                                </div>
                            </div>
                            <div className={cn("flex items-center gap-3 relative z-10", compact ? "pt-4" : "pt-8")}>
                                <div className="flex -space-x-3">
                                    {visibleMembers.slice(0, 5).map((pk, i) => (<div key={pk} className="group-hover/bento:-translate-y-1 transition-transform" style={{ transitionDelay: `${i * 50}ms` }}>
                                            <UserAvatar pubkey={pk} size="md" metadataLive={false} showProfileOnClick={false} className="h-12 w-12 rounded-2xl border-[3px] border-white bg-zinc-100 shadow-lg dark:border-[#0C0C0E] dark:bg-[#1A1A1E]" fallbackClassName="bg-zinc-200 text-xs font-black text-zinc-900 dark:bg-[#1A1A1E] dark:text-white"/>
                                        </div>))}
                                    {visibleMembers.length > 5 && (<div className="flex h-12 w-12 items-center justify-center rounded-2xl border-[3px] border-white bg-zinc-100 text-xs font-black text-zinc-600 shadow-xl dark:border-[#0C0C0E] dark:bg-zinc-900 dark:text-zinc-500">
                                            +{visibleMembers.length - 5}
                                        </div>)}
                                </div>
                                <div className="h-1.5 w-1.5 rounded-full bg-zinc-400 mx-2 dark:bg-zinc-700"/>
                                <span className="text-xs font-black uppercase tracking-widest text-zinc-800 dark:text-zinc-400">{t("groups.home.access.openParticipants")}</span>
                            </div>
                        </Card>
                    </button>

                    {/* Registry Visibility - Tall */}
                    <Card className={cn("flex flex-col justify-between hover:border-indigo-500/20 transition-all duration-500 group/bento overflow-hidden relative", compact ? "rounded-2xl p-4" : "rounded-[40px] p-8", tablet ? "sm:col-span-1" : "md:col-span-2 lg:col-span-3", safeVisualMode
            ? "border-black/10 bg-white/95 dark:border-white/[0.05] dark:bg-[#0C0C0E]/90"
            : "border-black/10 bg-white/80 backdrop-blur-xl dark:border-white/[0.03] dark:bg-[#0C0C0E]/40")}>
                        {!compact ? (<div className="absolute right-0 top-0 p-8">
                            <Shield className="h-10 w-10 text-indigo-500/20"/>
                        </div>) : null}
                        <div className={compact ? "space-y-2" : "space-y-4"}>
                            {!compact ? (<div className="h-14 w-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                                <Shield className="h-7 w-7 text-indigo-400"/>
                            </div>) : null}
                            <h3 className={cn("font-black text-zinc-900 dark:text-white", compact ? "text-base" : "text-2xl")}>{t("groups.home.registry.title")}</h3>
                            <p className={cn("font-medium leading-relaxed text-zinc-700 dark:text-zinc-500", compact ? "text-xs" : "text-sm")}>
                                {t("groups.home.registry.visibilityIntro")}{" "}
                                <span className="font-black text-indigo-600 dark:text-indigo-400">{communityAccessModeLabel}</span>.
                                {compact
            ? (communityAccessMode === "invite-only" ? t("groups.home.registry.inviteOnlyCompact") : t("groups.home.registry.publicListedCompact"))
            : (communityAccessMode === "invite-only"
                ? t("groups.home.registry.inviteOnlyFull")
                : t("groups.home.registry.publicListedFull"))}
                            </p>
                        </div>
                        <div className={compact ? "pt-3" : "pt-6"}>
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500/5 border border-indigo-500/10">
                                <div className="h-1.5 w-1.5 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.5)]"/>
                                <span className="text-[10px] font-black uppercase tracking-[0.1em] text-indigo-900 dark:text-indigo-300">{t("groups.home.registry.encryptedStorage")}</span>
                            </div>
                        </div>
                    </Card>

                    {/* Infrastructure Card - Wide Bottom */}
                    <Card className={cn("flex flex-col items-center justify-between hover:border-zinc-500/20 transition-all duration-500 group/bento", compact ? "gap-3 rounded-2xl p-4" : tablet ? "gap-4 rounded-3xl p-6 sm:col-span-2 sm:flex-row" : "gap-8 rounded-[40px] p-8 md:flex-row md:col-span-4 lg:col-span-6", safeVisualMode
            ? "border-black/10 bg-white/95 dark:border-white/[0.05] dark:bg-[#0C0C0E]/90"
            : "border-black/10 bg-white/80 backdrop-blur-xl dark:border-white/[0.03] dark:bg-[#0C0C0E]/40")}>
                        <div className={cn("flex items-center w-full min-w-0", compact ? "gap-3" : "gap-6")}>
                            <div className={cn("rounded-3xl bg-zinc-500/10 flex items-center justify-center border border-zinc-500/20 shrink-0", compact ? "h-10 w-10 rounded-xl" : "h-16 w-16")}>
                                <ExternalLink className={cn("text-zinc-500 dark:text-zinc-400", compact ? "h-4 w-4" : "h-8 w-8")}/>
                            </div>
                            <div className="min-w-0 space-y-1">
                                <h3 className={cn("font-black text-zinc-900 dark:text-white", compact ? "text-base" : "text-2xl")}>{t("groups.home.relay.title")}</h3>
                                <p className={cn("font-medium text-zinc-700 opacity-80 dark:text-zinc-500 truncate", compact ? "text-xs" : "text-sm font-mono")} title={effectiveRelay}>
                                    {compact ? relayHostLabel : effectiveRelay}
                                </p>
                            </div>
                        </div>
                        <div className={cn("flex items-center", compact ? "w-full justify-between gap-3" : "gap-8")}>
                            <div className={cn("text-right", compact ? "min-w-0 text-left flex-1" : "hidden sm:block")}>
                                <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1">{t("groups.home.relay.statusLabel")}</p>
                                <p className={cn("text-xs font-black", isRelayDegraded ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-green-500")}>{relayStatusLabel}</p>
                                {!compact ? (<p className="mt-1 max-w-[220px] text-[10px] leading-snug text-zinc-600 dark:text-zinc-500">{relayStatusDetail}</p>) : null}
                            </div>
                            <div className={cn("rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shrink-0", compact ? "h-9 w-9" : "h-12 w-12", isRelayDegraded ? "bg-amber-500/10 border border-amber-500/20" : "bg-green-500/10 border border-green-500/20")}>
                                <div className={cn("h-3 w-3 rounded-full", isRelayDegraded ? "bg-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.6)]" : "bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.6)]")}/>
                            </div>
                        </div>
                    </Card>
                </div>

                <div className="space-y-6">
                    <ManagementSectionHeader title={t("groups.home.personalControls.title")} tone="danger" description={communityRelayTransportReady
            ? t("groups.home.personalControls.descriptionReady")
            : t("groups.home.personalControls.descriptionNoRelay", { relay: effectiveRelay })}/>

                    <ManagementControlCard className={cn(safeVisualMode
            ? "border-black/10 bg-white/95 dark:border-white/[0.05] dark:bg-[#0C0C0E]/90"
            : "border-black/10 bg-white/80 dark:border-white/[0.03] dark:bg-[#0C0C0E]/40")}>
                        <ManagementControlRow icon={Ban} title={isBlocked ? t("groups.home.block.unblockTitle") : t("groups.home.block.title")} description={isBlocked
            ? t("groups.home.block.unblockDescription")
            : t("groups.home.block.description")} onClick={handleBlockAction}/>
                        <ManagementControlRow icon={Trash2} title={t("groups.home.delete.title")} description={t("groups.deleteCommunityHint", { profileLabel: activeProfileLabel })} onClick={handleDeleteCommunity} showDivider/>
                    </ManagementControlCard>
                </div>

                {!isGuest && group && shouldMountGroupManagementDialog(isManagementOpen) ? (<GroupManagementDialog isOpen onClose={() => {
                setIsManagementOpen(false);
                setManagementInitialTab(undefined);
            }} initialTab={managementInitialTab} group={group} pool={relayPool} myPublicKeyHex={identityState.publicKeyHex || null} myPrivateKeyHex={identityState.privateKeyHex || null} communityController={sealedCommunityController}/>) : null}

                {!isGuest && group && (<InviteConnectionsDialog isOpen={isInviteConnectionsOpen} onClose={() => setIsInviteConnectionsOpen(false)} groupId={group.groupId} relayUrl={group.relayUrl} roomKeyHex={roomKeyHex || ""} communityId={group.communityId} genesisEventId={group.genesisEventId} creatorPubkey={group.creatorPubkey} onRefreshMembership={refreshMembershipForInviteOpen} currentMemberPubkeys={inviteEligibleMemberPubkeys} metadata={{
                id: group.groupId,
                name: displayName,
                about: aboutText,
                picture: avatarUrl || "",
                access: groupState.metadata?.access || "invite-only"
            }}/>)}

                <CommunityFindInCommunityPicker
                    open={isMemberListOpen}
                    onClose={closeMemberList}
                    visiblePubkeys={activeVisibleMembers}
                    authorEvidencePubkeys={authorEvidencePubkeys}
                    acceptedPeers={peerTrust.state.acceptedPeers}
                    selfPubkey={localMemberPubkey}
                    activeMemberPubkeys={activeMembers}
                    provisionalMemberPubkeys={provisionalMemberPubkeys}
                    membershipEvidenceUiContext={membershipEvidenceUiContext}
                    terminalEntries={terminalMemberEntries}
                    isPeerOnline={(pubkey) => presence.isPeerOnline(pubkey)}
                    getSearchHaystack={(pubkey) => {
                        const profile = discoveryCache.getProfile(pubkey);
                        return [
                            profile?.displayName,
                            profile?.name,
                            profile?.nip05,
                            profile?.about,
                        ].filter((value): value is string => typeof value === "string" && value.length > 0).join(" ");
                    }}
                    onOpenProfile={(memberPubkey) => {
                        closeMemberList();
                        router.push(getPublicProfileHref(memberPubkey));
                    }}
                    onClearTerminalConfirmed={handleClearTerminalMembership}
                />

            </div>
        </PageShell>);
}
