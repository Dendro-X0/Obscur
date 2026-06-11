"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Loader2, QrCode, Share2 } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { useCommunityGovernanceProjection } from "../hooks/use-community-governance-projection";
import { useSealedCommunity, type UseSealedCommunityResult } from "../hooks/use-sealed-community";
import type { GovernanceProposalRecord } from "../services/community-governance-reducer";
import { useUploadService } from "@/app/features/messaging/lib/upload-service";
import { useGroups } from "../providers/group-provider";
import { toast } from "../../../components/ui/toast";
import { GroupQRCode } from "./group-qr-code";
import { InviteMemberDialog } from "./invite-member-dialog";
import type { GroupConversation } from "../../messaging/types";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import {
    isConversationNotificationsEnabled,
    setConversationNotificationsEnabled,
} from "@/app/features/notifications/utils/notification-target-preference";
import { getPublicGroupHref, toAbsoluteAppUrl } from "@/app/features/navigation/public-routes";
import { useNetwork } from "@/app/features/network/providers/network-provider";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { useRelayList } from "@/app/features/relays/hooks/use-relay-list";
import { useRelayPoolRef } from "@/app/features/relays/hooks/use-relay-pool-ref";
import { useRelayCapabilities } from "@/app/features/relays/hooks/use-relay-capabilities";
import {
    COMMUNITY_MODE_DEFINITIONS,
    isManagedWorkspaceRelayGateBlocking,
    resolveManagedWorkspaceRelayGate,
} from "../services/community-mode-contract";
import type { CommunityMode } from "../types/community-mode";
import { resolveCommunityStewardPolicy } from "../services/community-steward-policy";
import { resolveCommunityDirectoryMaterializationHonesty } from "../services/community-directory-materialization-policy";
import { readMembershipSyncMode } from "../services/community-membership-sync-mode";
import type { MembershipEvidenceUiContext } from "../utils/community-membership-evidence-display";
import { ManagedWorkspaceRelayGateBanner } from "./group-management/managed-workspace-relay-gate-banner";
import { discoveryCache } from "@/app/features/search/services/discovery-cache";
import { filterVisibleGroupMembers } from "../services/community-visible-members";
import { resolveCommunityInviteMemberBlocklist } from "../services/community-invite-eligibility-read-model";
import {
    mergeCoordinationTerminalMemberPubkeys,
    resolveCommunityParticipantDisplayPubkeys,
    shouldApplyTerminalMembershipExclusionsToParticipantRoster,
} from "../services/community-participant-display-read-model";
import { useCoordinationMembershipDirectory } from "../hooks/use-coordination-membership-directory";
import { buildManagedWorkspaceRosterRepairContext } from "../services/managed-workspace-roster-repair-context";
import { resolveEffectiveCommunityMode } from "../services/community-workspace-r1-policy";
import { useCommunityMemberDisplayNames } from "../hooks/use-community-member-display-names";
import { useCommunityParticipantRosterReadModel } from "../hooks/use-community-participant-roster-read-model";
import { resolveCommunityDisplayName } from "../services/community-display-name";
import {
    loadCommunityProvisionalMemberPubkeys,
    stripProvisionalCommunityMembersConfirmedOnRelay,
} from "../services/community-provisional-membership-cache";
import {
    clearCommunityTerminalMembershipEvidence,
} from "../services/community-membership-evidence-actions";
import { reconcileWorkspaceMembershipEvidence } from "../services/community-workspace-membership-reconcile";
import { usesCoordinationMembershipDirectory } from "../services/community-workspace-transport-policy";
import {
    loadCommunityTerminalMembershipCache,
    mergeTerminalMemberPubkeys,
    stripTerminalCommunityMembersWithActiveEvidence,
} from "../services/community-terminal-membership-cache";
import { resolveUserFacingErrorMessage } from "@/app/features/relays/services/relay-publish-user-copy";
import { hasWritableCommunityRelayTransport } from "../services/community-relay-transport";
import { getResolvedClientGateway } from "@/app/features/profiles/services/resolve-client-gateway";
import { buildGroupLeaveHref, buildGroupPurgeHref } from "../utils/group-action-route";
import { summarizeCommunityOperatorHealth } from "../services/community-operator-health";
import type { GroupAccessMode } from "../types";
import { readBotPubkeysFromMetadataField } from "../services/community-bot-policy";
import {
  normalizeBotTriggersForDescriptor,
  readBotTriggersFromMetadataField,
} from "../services/community-bot-triggers-policy";
import type { CommunityBotTriggerEntry } from "../services/community-bot-triggers-policy";
import type { GroupManagementTabId } from "./group-management/constants";
import { GroupManagementShell } from "./group-management/shell";
import { GroupManagementGeneralPanel } from "./group-management/panels/general-panel";
import { GroupManagementMembersPanel } from "./group-management/panels/members-panel";
import { GroupManagementGovernancePanel } from "./group-management/panels/governance-panel";
import { GroupManagementSettingsPanel } from "./group-management/panels/settings-panel";
import { resolveGroupManagementSealedCommunityEnabled } from "../services/sealed-community-instance-policy";

interface GroupManagementDialogProps {
    isOpen: boolean;
    onClose: () => void;
    group: GroupConversation;
    pool: any;
    myPublicKeyHex: PublicKeyHex | null;
    myPrivateKeyHex: any;
    /** When provided, reuses the parent subscription instead of opening a second `useSealedCommunity`. */
    communityController?: UseSealedCommunityResult;
    /** Opens directly to a tab (e.g. governance from home banner). */
    initialTab?: GroupManagementTabId;
}

export function GroupManagementDialog({
    isOpen,
    onClose,
    group,
    pool,
    myPublicKeyHex,
    myPrivateKeyHex,
    communityController,
    initialTab,
}: GroupManagementDialogProps) {
    const poolRef = useRelayPoolRef(pool);
    const router = useRouter();
    const { t } = useTranslation();
    const { communityKnownParticipantDirectoryByConversationId, communityRosterByConversationId } = useGroups();
    const { presence } = useNetwork();
    const localMemberPubkey = myPublicKeyHex;
    const initialMemberSeed = React.useMemo<ReadonlyArray<PublicKeyHex>>(
        () => getResolvedClientGateway().communityRoster.resolveSeedMemberPubkeysFromDirectory({
            directory: communityKnownParticipantDirectoryByConversationId[group.id] ?? null,
            persistedGroupMemberPubkeys: group.memberPubkeys,
            projectionMemberPubkeys: communityRosterByConversationId[group.id]?.activeMemberPubkeys,
            localMemberPubkey,
        }),
        [communityKnownParticipantDirectoryByConversationId, communityRosterByConversationId, group.id, group.memberPubkeys, localMemberPubkey],
    );
    const internalCommunity = useSealedCommunity({
        communityMode: group.communityMode,
        groupId: group.groupId,
        relayUrl: group.relayUrl,
        ...(group.communityId ? { communityId: group.communityId } : {}),
        pool,
        myPublicKeyHex,
        myPrivateKeyHex,
        initialMembers: initialMemberSeed,
        enabled: resolveGroupManagementSealedCommunityEnabled({
            isOpen,
            hasParentController: Boolean(communityController),
        }),
    });
    const {
        state,
        updateMetadata,
        proposeDescriptorUpdate,
        proposeExpelMember,
        expelMemberDirect,
        sendVoteKick,
        castGovernanceVote,
        rotateRoomKey,
        refresh: refreshCommunityMembership,
        clearLocalTerminalMembershipEvidence,
        applyCoordinationSemanticMemberEvent,
    } = communityController ?? internalCommunity;

    const communityRelayTransportReady = React.useMemo(
        () => hasWritableCommunityRelayTransport(group.relayUrl),
        [group.relayUrl],
    );

    const { activeProposals: activeGovernanceProposals, activeProposalCount } = useCommunityGovernanceProjection({
        groupId: group.groupId,
        communityId: group.communityId,
        enabled: isOpen && communityRelayTransportReady,
    });

    const { uploadFile, pickFiles } = useUploadService();
    const [activeTab, setActiveTab] = useState<GroupManagementTabId>("general");
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isQrModalOpen, setIsQrModalOpen] = useState(false);

    const [editName, setEditName] = useState("");
    const [editAbout, setEditAbout] = useState("");
    const [editPicture, setEditPicture] = useState("");
    const [editAccess, setEditAccess] = useState<GroupAccessMode>("invite-only");
    const [editBotPubkeys, setEditBotPubkeys] = useState<ReadonlyArray<PublicKeyHex>>([]);
    const [editBotTriggers, setEditBotTriggers] = useState<ReadonlyArray<CommunityBotTriggerEntry>>([]);

    const [memberSearchQuery, setMemberSearchQuery] = useState("");
    const [provisionalOverlayEpoch, setProvisionalOverlayEpoch] = useState(0);
    const [mutedMembers, setMutedMembers] = useState<string[]>([]);
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const getScopedMutedMembersKey = (groupId: string): string => (
        getScopedStorageKey(`obscur_group_muted_members_${groupId}`, getResolvedProfileId())
    );
    const getLegacyMutedMembersKey = (groupId: string): string => `obscur_group_muted_members_${groupId}`;
    const notificationPreferenceProfileId = getResolvedProfileId();
    const isLocalAdmin = group.adminPubkeys?.includes(myPublicKeyHex || "") || false;
    const isAdmin = state.membership.role === "member" || isLocalAdmin;
    const isOwner = isAdmin;

    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [kickingMemberPubkey, setKickingMemberPubkey] = useState<string | null>(null);
    const [isRotatingKey, setIsRotatingKey] = useState(false);
    const [currentTime, setCurrentTime] = React.useState(Date.now());

    React.useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(Date.now());
        }, 10000);
        return () => clearInterval(interval);
    }, []);

    const [roomKeyHex, setRoomKeyHex] = useState<string>();

    const { capabilities: relayCapabilities, isLoading: isRelayCapabilitiesLoading } = useRelayCapabilities(group.relayUrl);
    const identity = useIdentity();
    const relayList = useRelayList({ publicKeyHex: identity.state.publicKeyHex || null });
    const managedWorkspaceRelayGate = React.useMemo(
        () => resolveManagedWorkspaceRelayGate({
            communityMode: group.communityMode,
            enabledRelayUrls: relayList.state.relays.map((relay) => relay.url),
            communityRelayUrl: group.relayUrl,
        }),
        [group.communityMode, group.relayUrl, relayList.state.relays],
    );
    const managedWorkspaceActionsBlocked = isManagedWorkspaceRelayGateBlocking(managedWorkspaceRelayGate);
    const membershipSyncMode = readMembershipSyncMode();
    const membershipEvidenceUiContext = React.useMemo(
        (): MembershipEvidenceUiContext => ({ membershipSyncMode }),
        [membershipSyncMode],
    );
    const directoryHonesty = React.useMemo(
        () => resolveCommunityDirectoryMaterializationHonesty({
            communityMode: state.metadata?.communityMode ?? group.communityMode,
            relayCapabilityTier: managedWorkspaceRelayGate.assessment.tier,
            membershipSyncMode,
        }),
        [
            group.communityMode,
            managedWorkspaceRelayGate.assessment.tier,
            membershipSyncMode,
            state.metadata?.communityMode,
        ],
    );

    const requireManagedWorkspaceRelayGate = React.useCallback((): boolean => {
        if (!managedWorkspaceRelayGate.allowed) {
            toast.error(
                managedWorkspaceRelayGate.userMessage
                || "Managed Workspace actions are unavailable on this relay setup.",
            );
            return false;
        }
        return true;
    }, [managedWorkspaceRelayGate]);

    useEffect(() => {
        const fetchRoomKey = async () => {
            const { roomKeyStore } = await import("../../crypto/room-key-store");
            const key = await roomKeyStore.getRoomKey(group.groupId);
            if (key) setRoomKeyHex(key);
        };
        void fetchRoomKey();
    }, [group.groupId]);

    const exportCommunity = async () => {
        try {
            const { roomKeyStore } = await import("../../crypto/room-key-store");
            const record = await roomKeyStore.getRoomKeyRecord(group.groupId);

            const exportData = {
                version: 1,
                groupId: group.groupId,
                metadata: state.metadata,
                keys: record || { roomKeyHex: roomKeyHex, previousKeys: [] },
                exportedAt: new Date().toISOString(),
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `obscur-community-${group.groupId.slice(0, 8)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            toast.success("Community backup downloaded successfully");
        } catch (error) {
            console.error("Export failed:", error);
            toast.error("Failed to export community data");
        }
    };

    useEffect(() => {
        const saved =
            localStorage.getItem(getScopedMutedMembersKey(group.groupId))
            ?? localStorage.getItem(getLegacyMutedMembersKey(group.groupId));
        if (saved) {
            try {
                setMutedMembers(JSON.parse(saved));
            } catch {
                // ignore corrupt storage
            }
        }

        setNotificationsEnabled(isConversationNotificationsEnabled(group, notificationPreferenceProfileId));
    }, [group.groupId, group.id, notificationPreferenceProfileId]);

    const toggleMute = (pk: string) => {
        const next = mutedMembers.includes(pk)
            ? mutedMembers.filter((member) => member !== pk)
            : [...mutedMembers, pk];
        setMutedMembers(next);
        localStorage.setItem(getScopedMutedMembersKey(group.groupId), JSON.stringify(next));
        toast.success(mutedMembers.includes(pk) ? "Member unmuted" : "Member muted");
    };

    const toggleNotifications = () => {
        const next = !notificationsEnabled;
        setNotificationsEnabled(next);
        setConversationNotificationsEnabled({
            conversation: group,
            enabled: next,
            profileId: getResolvedProfileId(),
        });
        toast.success(next ? "Notifications enabled" : "Notifications disabled");
    };

    useEffect(() => {
        if (state.metadata) {
            setEditName(
                resolveCommunityDisplayName({
                    metadataName: state.metadata.name,
                    persistedDisplayName: group.displayName,
                    groupId: group.groupId,
                    communityId: group.communityId,
                    fallback: group.displayName,
                }),
            );
            setEditAbout(state.metadata.about || "");
            setEditPicture(state.metadata.picture || "");
            setEditAccess(state.metadata.access || "public");
            setEditBotPubkeys(readBotPubkeysFromMetadataField(state.metadata.botPubkeys));
            setEditBotTriggers(readBotTriggersFromMetadataField(state.metadata.botTriggers));
        }
    }, [state.metadata, group.communityId, group.displayName, group.groupId]);

    useEffect(() => {
        setEditBotTriggers((current) => normalizeBotTriggersForDescriptor(current, editBotPubkeys));
    }, [editBotPubkeys]);

    const projectionMemberPubkeys = communityRosterByConversationId[group.id]?.activeMemberPubkeys as
        ReadonlyArray<PublicKeyHex> | undefined;
    const { activeMemberPubkeys: activeMembers, authorEvidencePubkeys } = React.useMemo(
        () => getResolvedClientGateway().communityRoster.resolveActiveMemberPubkeysFromConversation({
            communityMessages: state.messages,
            seededMemberPubkeys: initialMemberSeed,
            projectionMemberPubkeys,
            localMemberPubkey,
            leftMemberPubkeys: state.leftMembers,
            expelledMemberPubkeys: state.expelledMembers,
        }),
        [
            initialMemberSeed,
            localMemberPubkey,
            projectionMemberPubkeys,
            state.expelledMembers,
            state.leftMembers,
            state.messages,
        ],
    );
    const provisionalMemberPubkeys = React.useMemo(
        () => loadCommunityProvisionalMemberPubkeys({
            groupId: group.groupId,
            relayUrl: group.relayUrl,
            profileId: getResolvedProfileId(),
        }),
        [group.groupId, group.relayUrl, provisionalOverlayEpoch],
    );
    const mergedManagementMemberPubkeys = React.useMemo(
        () => Array.from(new Set([...activeMembers, ...provisionalMemberPubkeys])) as ReadonlyArray<PublicKeyHex>,
        [activeMembers, provisionalMemberPubkeys],
    );
    const communityModeForR1 = (
        state.metadata?.communityMode === "managed_workspace" || state.metadata?.communityMode === "sovereign_room"
            ? state.metadata.communityMode
            : group.communityMode
    );
    const directoryParticipantPubkeys = React.useMemo(
        () => (communityKnownParticipantDirectoryByConversationId[group.id]?.participantPubkeys ?? []) as ReadonlyArray<PublicKeyHex>,
        [communityKnownParticipantDirectoryByConversationId, group.id],
    );
    const relayEvidenceConfidence = (
        state as { relayEvidenceRef?: { confidenceLevel: "seed_only" | "warming_up" | "partial_eose" | "steady_state" } }
    ).relayEvidenceRef?.confidenceLevel ?? "seed_only";

    const terminalMembershipCache = React.useMemo(
        () => loadCommunityTerminalMembershipCache({
            groupId: group.groupId,
            relayUrl: group.relayUrl,
            profileId: getResolvedProfileId(),
        }),
        [group.groupId, group.relayUrl],
    );
    const effectiveLeftMemberPubkeys = React.useMemo(
        () => mergeTerminalMemberPubkeys(
            terminalMembershipCache?.leftMemberPubkeys ?? [],
            state.leftMembers,
        ),
        [state.leftMembers, terminalMembershipCache],
    );
    const effectiveExpelledMemberPubkeys = React.useMemo(
        () => mergeTerminalMemberPubkeys(
            terminalMembershipCache?.expelledMemberPubkeys ?? [],
            state.expelledMembers,
        ),
        [state.expelledMembers, terminalMembershipCache],
    );

    const {
        resolvedCommunityId,
        communityIdCandidates,
        joinEvidenceMemberPubkeys,
    } = React.useMemo(
        () => buildManagedWorkspaceRosterRepairContext({
            group,
            publicKeyHex: myPublicKeyHex,
        }),
        [group, myPublicKeyHex],
    );
    const coordinationMembershipDirectory = useCoordinationMembershipDirectory(
        resolvedCommunityId,
    );

    const effectiveCommunityMode = React.useMemo(
        () => resolveEffectiveCommunityMode(communityModeForR1, group.relayUrl),
        [communityModeForR1, group.relayUrl],
    );
    const inviteEligibleMemberPubkeys = React.useMemo(
        () => resolveCommunityInviteMemberBlocklist({
            communityMode: effectiveCommunityMode,
            relayUrl: group.relayUrl,
            coordinationDirectory: coordinationMembershipDirectory,
            hybridActiveMemberPubkeys: mergedManagementMemberPubkeys,
            joinEvidenceMemberPubkeys,
            leftMemberPubkeys: effectiveLeftMemberPubkeys,
            expelledMemberPubkeys: effectiveExpelledMemberPubkeys,
        }),
        [
            coordinationMembershipDirectory,
            effectiveCommunityMode,
            effectiveExpelledMemberPubkeys,
            effectiveLeftMemberPubkeys,
            group.relayUrl,
            joinEvidenceMemberPubkeys,
            mergedManagementMemberPubkeys,
        ],
    );

    const rosterLeftMemberPubkeys = React.useMemo(
        () => mergeCoordinationTerminalMemberPubkeys(
            effectiveLeftMemberPubkeys,
            coordinationMembershipDirectory,
            "left",
        ),
        [coordinationMembershipDirectory, effectiveLeftMemberPubkeys],
    );
    const rosterExpelledMemberPubkeys = React.useMemo(
        () => mergeCoordinationTerminalMemberPubkeys(
            effectiveExpelledMemberPubkeys,
            coordinationMembershipDirectory,
            "expelled",
        ),
        [coordinationMembershipDirectory, effectiveExpelledMemberPubkeys],
    );

    const { displayPubkeys: rosterDisplayPubkeys } = useCommunityParticipantRosterReadModel({
        conversationId: group.id,
        directoryParticipantPubkeys,
        persistedGroupMemberPubkeys: (group.memberPubkeys ?? []) as ReadonlyArray<PublicKeyHex>,
        projectionMemberPubkeys,
        rosterSeedPubkeys: initialMemberSeed,
        communityMessages: state.messages,
        localMemberPubkey,
        leftMemberPubkeys: rosterLeftMemberPubkeys,
        expelledMemberPubkeys: rosterExpelledMemberPubkeys,
        relayEvidenceConfidence,
        persistedEvidenceOwnerPubkey: localMemberPubkey,
        ledgerGroupId: group.groupId,
        ledgerRelayUrl: group.relayUrl,
        applyTerminalMembershipExclusions: shouldApplyTerminalMembershipExclusionsToParticipantRoster(
            communityModeForR1,
            coordinationMembershipDirectory,
        ),
    });

    const participantDisplayPubkeys = React.useMemo(
        () => resolveCommunityParticipantDisplayPubkeys({
            communityMode: effectiveCommunityMode,
            relayUrl: group.relayUrl,
            coordinationDirectory: coordinationMembershipDirectory,
            monotonicDisplayPubkeys: rosterDisplayPubkeys,
            joinEvidenceMemberPubkeys,
            localMemberPubkey,
            localLeftMemberPubkeys: effectiveLeftMemberPubkeys,
            localExpelledMemberPubkeys: effectiveExpelledMemberPubkeys,
        }),
        [
            coordinationMembershipDirectory,
            effectiveCommunityMode,
            effectiveExpelledMemberPubkeys,
            effectiveLeftMemberPubkeys,
            group.relayUrl,
            joinEvidenceMemberPubkeys,
            localMemberPubkey,
            rosterDisplayPubkeys,
        ],
    );

    const visibleMemberRegistry = React.useMemo(
        () => filterVisibleGroupMembers(participantDisplayPubkeys, (pubkey) => discoveryCache.getProfile(pubkey)),
        [participantDisplayPubkeys],
    );
    const onlineMemberCount = React.useMemo(
        () => visibleMemberRegistry.filter((pubkey) => presence.isPeerOnline(pubkey)).length,
        [visibleMemberRegistry, presence],
    );
    const operatorHealth = React.useMemo(
        () => summarizeCommunityOperatorHealth({
            activeMembers: visibleMemberRegistry,
            leftMembers: state.leftMembers,
            expelledMembers: state.expelledMembers,
            onlineMemberCount,
            kickVotes: state.kickVotes,
            disbandedAt: state.disbandedAt,
        }),
        [onlineMemberCount, state.disbandedAt, state.expelledMembers, state.kickVotes, state.leftMembers, visibleMemberRegistry],
    );
    const stewardPolicy = React.useMemo(
        () => resolveCommunityStewardPolicy({
            communityMode: state.metadata?.communityMode ?? group.communityMode,
            stewardPubkeys: state.metadata?.stewardPubkeys,
            actorPublicKeyHex: myPublicKeyHex,
            activeMemberCount: activeMembers.length,
        }),
        [
            activeMembers.length,
            group.communityMode,
            myPublicKeyHex,
            state.metadata?.communityMode,
            state.metadata?.stewardPubkeys,
        ],
    );
    const requiresMemberVote = stewardPolicy.requiresGovernanceVoteForDescriptor;

    React.useEffect(() => {
        const profileId = getResolvedProfileId();
        const terminalChanged = stripTerminalCommunityMembersWithActiveEvidence({
            groupId: group.groupId,
            relayUrl: group.relayUrl,
            profileId,
            relayBackedMemberPubkeys: activeMembers,
            conversationAuthorPubkeys: authorEvidencePubkeys,
        });
        const provisionalChanged = stripProvisionalCommunityMembersConfirmedOnRelay({
            groupId: group.groupId,
            relayUrl: group.relayUrl,
            profileId,
            relayBackedMemberPubkeys: activeMembers,
        });
        if (terminalChanged || provisionalChanged) {
            setProvisionalOverlayEpoch((e) => e + 1);
        }
    }, [activeMembers, authorEvidencePubkeys, group.groupId, group.relayUrl]);

    const handleReconcileMembership = React.useCallback(async () => {
        const communityMode = resolveEffectiveCommunityMode(group.communityMode, group.relayUrl);
        const outcome = await reconcileWorkspaceMembershipEvidence({
            groupId: group.groupId,
            relayUrl: group.relayUrl,
            profileId: getResolvedProfileId(),
            communityId: resolvedCommunityId,
            communityIdCandidates,
            communityMode,
            refreshRelaySubscription: refreshCommunityMembership,
            onSemanticMemberEvent: usesCoordinationMembershipDirectory(communityMode, group.relayUrl)
                ? applyCoordinationSemanticMemberEvent
                : undefined,
        });
        setProvisionalOverlayEpoch((e) => e + 1);
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
        communityIdCandidates,
        group.communityMode,
        group.groupId,
        group.relayUrl,
        refreshCommunityMembership,
        resolvedCommunityId,
        t,
    ]);

    const terminalRecordCount = React.useMemo(
        () => new Set([...effectiveLeftMemberPubkeys, ...effectiveExpelledMemberPubkeys]).size,
        [effectiveExpelledMemberPubkeys, effectiveLeftMemberPubkeys],
    );

    const handleClearTerminalMembership = React.useCallback(() => {
        clearCommunityTerminalMembershipEvidence({
            groupId: group.groupId,
            relayUrl: group.relayUrl,
            clearLocalTerminalMembershipEvidence,
            refreshRelaySubscription: refreshCommunityMembership,
        });
        toast.success(
            t(
                "groups.membershipEvidence.clearTerminalToast",
                "Terminal membership cache cleared. Refreshing relay membership.",
            ),
        );
    }, [clearLocalTerminalMembershipEvidence, group.groupId, group.relayUrl, refreshCommunityMembership, t]);

    const groupActionRouteParams = React.useMemo(() => ({
        routeToken: group.groupId,
        relayUrl: group.relayUrl,
        displayName: state.metadata?.name || group.displayName,
        communityId: group.communityId,
    }), [group.communityId, group.displayName, group.groupId, group.relayUrl, state.metadata?.name]);

    const openLeaveConfirmation = () => {
        onClose();
        router.push(buildGroupLeaveHref(groupActionRouteParams));
    };

    const openPurgeConfirmation = () => {
        onClose();
        router.push(buildGroupPurgeHref(groupActionRouteParams));
    };

    const handleVoteKick = async (memberPubkey: string) => {
        if (!requireManagedWorkspaceRelayGate()) {
            return;
        }
        setKickingMemberPubkey(memberPubkey);
        try {
            if (stewardPolicy.canDirectMemberExpel) {
                await expelMemberDirect({ targetPublicKeyHex: memberPubkey as PublicKeyHex });
            } else if (activeMembers.length > 2) {
                await proposeExpelMember({ targetPublicKeyHex: memberPubkey as PublicKeyHex });
            } else {
            await sendVoteKick(memberPubkey);
            toast.success("Vote to kick submitted");
            }
        } catch (error) {
            toast.error(resolveUserFacingErrorMessage(error, "Failed to submit removal."));
        } finally {
            setKickingMemberPubkey(null);
        }
    };

    const handleRotateKey = async () => {
        if (!requireManagedWorkspaceRelayGate()) {
            return;
        }
        setIsRotatingKey(true);
        try {
            await rotateRoomKey();
            toast.success("Room key rotated and distributed to members");
        } catch {
            toast.error("Failed to rotate room key");
        } finally {
            setIsRotatingKey(false);
        }
    };

    useEffect(() => {
        if (!isOpen) {
            return;
        }
        if (!communityRelayTransportReady) {
            setActiveTab("settings");
            return;
        }
        setActiveTab(initialTab ?? "general");
    }, [communityRelayTransportReady, initialTab, isOpen]);

    const resolvedNames = useCommunityMemberDisplayNames({
        enabled: isOpen && communityRelayTransportReady,
        memberPubkeys: visibleMemberRegistry,
        pool: poolRef.current,
    });

    if (!isOpen) return null;

    const handleSaveGeneral = async () => {
        if (!requireManagedWorkspaceRelayGate()) {
            return;
        }
        setIsSaving(true);
        try {
            const metadataPayload = {
                id: group.groupId,
                name: editName,
                about: editAbout,
                picture: editPicture,
                access: editAccess,
                botPubkeys: editBotPubkeys,
                botTriggers: normalizeBotTriggersForDescriptor(editBotTriggers, editBotPubkeys),
            };
            if (requiresMemberVote) {
                await proposeDescriptorUpdate(metadataPayload);
                toast.success("Governance proposal created");
            } else {
                await updateMetadata(metadataPayload);
            toast.success("Community settings updated");
            }
        } catch (error) {
            toast.error(resolveUserFacingErrorMessage(error, "Failed to update settings."));
        } finally {
            setIsSaving(false);
        }
    };

    const describeGovernanceProposal = (proposal: GovernanceProposalRecord): string => {
        if (proposal.actionType === "update_descriptor") {
            const name = "name" in proposal.payload && typeof proposal.payload.name === "string"
                ? proposal.payload.name
                : null;
            const botCount = "botPubkeys" in proposal.payload && Array.isArray(proposal.payload.botPubkeys)
                ? proposal.payload.botPubkeys.length
                : 0;
            if (botCount > 0) {
                return name
                    ? `Update descriptor (incl. ${botCount} outbound bot${botCount === 1 ? "" : "s"}) — “${name}”`
                    : `Register ${botCount} outbound bot${botCount === 1 ? "" : "s"} on descriptor`;
            }
            return name ? `Rename community to “${name}”` : "Update community descriptor";
        }
        if (proposal.actionType === "expel_member") {
            const target = "targetPublicKeyHex" in proposal.payload
                ? proposal.payload.targetPublicKeyHex
                : "member";
            return `Expel member ${target.slice(0, 8)}…`;
        }
        return proposal.actionType;
    };

    const handlePickAvatar = async () => {
                                                        const files = await pickFiles();
        if (!files?.[0]) return;
                                                            setIsUploading(true);
                                                            try {
                                                                const res = await uploadFile(files[0]);
                                                                setEditPicture(res.url);
                                                            } finally {
                                                                setIsUploading(false);
                                                            }
    };

    const communityTitle = resolveCommunityDisplayName({
        metadataName: state.metadata?.name,
        persistedDisplayName: group.displayName,
        groupId: group.groupId,
        communityId: group.communityId,
        fallback: "Community",
    });
    const communityInitial = communityTitle.trim().slice(0, 1).toUpperCase() || "C";
    const relayHost = group.relayUrl.replace(/^wss:\/\//, "").replace(/^https?:\/\//, "");
    const effectiveCommunityMode: CommunityMode = (
        state.metadata?.communityMode === "managed_workspace" || state.metadata?.communityMode === "sovereign_room"
    )
        ? state.metadata.communityMode
        : group.communityMode === "managed_workspace"
            ? "managed_workspace"
            : "sovereign_room";
    const communityModeLabel = COMMUNITY_MODE_DEFINITIONS[effectiveCommunityMode].label;
    const syncConfidenceLevel =
        (state as { relayEvidenceRef?: { confidenceLevel: "seed_only" | "warming_up" | "partial_eose" | "steady_state" } })
            .relayEvidenceRef?.confidenceLevel ?? "seed_only";

    const showShareInHeader = activeTab === "general" || activeTab === "settings";

    return (
        <>
            <GroupManagementShell
                isOpen={isOpen}
                onClose={onClose}
                relayGateNotice={
                    <ManagedWorkspaceRelayGateBanner gate={managedWorkspaceRelayGate} />
                }
                communityTitle={communityTitle}
                communityInitial={communityInitial}
                avatarUrl={state.metadata?.picture || editPicture || undefined}
                relayHost={relayHost}
                communityModeLabel={communityModeLabel}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                governanceBadgeCount={activeProposalCount}
                headerAction={
                    showShareInHeader ? (
                                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                                if (!requireManagedWorkspaceRelayGate()) {
                                    return;
                                }
                                setIsQrModalOpen(true);
                            }}
                            disabled={managedWorkspaceActionsBlocked}
                            className="rounded-lg border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                        >
                            <QrCode className="mr-2 h-4 w-4" />
                            Share invite
                                        </Button>
                    ) : undefined
                }
                footer={
                    activeTab === "general" && isAdmin ? (
                        <div className="flex justify-end gap-3">
                            <Button type="button" variant="ghost" onClick={onClose} className="rounded-lg text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">
                                Cancel
                            </Button>
                                        <Button
                                type="button"
                                onClick={() => void handleSaveGeneral()}
                                disabled={isSaving || managedWorkspaceActionsBlocked}
                                className="rounded-lg bg-violet-600 px-6 hover:bg-violet-500"
                            >
                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                {requiresMemberVote ? "Propose changes" : "Save changes"}
                                        </Button>
                                        </div>
                    ) : undefined
                }
            >
                {activeTab === "general" ? (
                    <GroupManagementGeneralPanel
                        editName={editName}
                        setEditName={setEditName}
                        editAbout={editAbout}
                        setEditAbout={setEditAbout}
                        editPicture={editPicture}
                        editAccess={editAccess}
                        setEditAccess={setEditAccess}
                        isAdmin={isAdmin}
                        isUploading={isUploading}
                        onPickAvatar={() => void handlePickAvatar()}
                        requiresMemberVote={requiresMemberVote}
                        stewardPolicy={stewardPolicy}
                        communityMode={group.communityMode}
                        relayUrl={group.relayUrl}
                        relayCapabilities={relayCapabilities}
                        isRelayCapabilitiesLoading={isRelayCapabilitiesLoading}
                        managedWorkspaceRelayGate={managedWorkspaceRelayGate}
                        editBotPubkeys={editBotPubkeys}
                        onEditBotPubkeysChange={setEditBotPubkeys}
                        editBotTriggers={editBotTriggers}
                        onEditBotTriggersChange={setEditBotTriggers}
                        requiresGovernanceProposal={requiresMemberVote}
                    />
                ) : null}

                {activeTab === "members" ? (
                    <GroupManagementMembersPanel
                        visibleMemberPubkeys={visibleMemberRegistry}
                        relayBackedMemberPubkeys={activeMembers}
                        provisionalMemberPubkeys={provisionalMemberPubkeys}
                        memberSearchQuery={memberSearchQuery}
                        setMemberSearchQuery={setMemberSearchQuery}
                        resolvedNames={resolvedNames}
                        onlineMemberCount={onlineMemberCount}
                        operatorHealth={operatorHealth}
                        myPublicKeyHex={myPublicKeyHex}
                        isAdmin={isAdmin}
                        mutedMembers={mutedMembers}
                        kickingMemberPubkey={kickingMemberPubkey}
                                                                currentTime={currentTime}
                        onInvite={() => {
                            if (!requireManagedWorkspaceRelayGate()) {
                                return;
                            }
                            setIsInviteModalOpen(true);
                        }}
                        onToggleMute={toggleMute}
                        onVoteKick={(pubkey) => void handleVoteKick(pubkey)}
                        syncConfidenceLevel={syncConfidenceLevel}
                        isPoolConnected={pool !== null}
                        terminalRecordCount={terminalRecordCount}
                        onReconcileMembership={handleReconcileMembership}
                        onClearTerminalMembership={handleClearTerminalMembership}
                        managedWorkspaceActionsBlocked={managedWorkspaceActionsBlocked}
                        directoryHonesty={directoryHonesty}
                        membershipEvidenceUiContext={membershipEvidenceUiContext}
                    />
                ) : null}

                {activeTab === "governance" ? (
                    <GroupManagementGovernancePanel
                        proposals={activeGovernanceProposals}
                        myPublicKeyHex={myPublicKeyHex}
                        describeProposal={describeGovernanceProposal}
                        onVote={(params) => void castGovernanceVote(params)}
                        managedWorkspaceActionsBlocked={managedWorkspaceActionsBlocked}
                    />
                ) : null}

                {activeTab === "settings" ? (
                    <GroupManagementSettingsPanel
                        notificationsEnabled={notificationsEnabled}
                        onToggleNotifications={toggleNotifications}
                        onShareInvite={() => {
                            if (!requireManagedWorkspaceRelayGate()) {
                                return;
                            }
                            setIsQrModalOpen(true);
                        }}
                        isRotatingKey={isRotatingKey}
                        onRotateKey={() => void handleRotateKey()}
                        onExport={() => void exportCommunity()}
                        onLeave={openLeaveConfirmation}
                        onPurge={openPurgeConfirmation}
                        showPurge={isLocalAdmin || !communityRelayTransportReady}
                        managedWorkspaceActionsBlocked={managedWorkspaceActionsBlocked}
                    />
                ) : null}
            </GroupManagementShell>

            <Dialog open={isQrModalOpen} onOpenChange={setIsQrModalOpen}>
                <DialogContent className="border-zinc-800 bg-zinc-950 sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-white">Invite to community</DialogTitle>
                        <p className="text-sm text-zinc-500">Scan the code or copy the join link.</p>
                    </DialogHeader>
                    <div className="space-y-4 p-2">
                        <div className="overflow-hidden rounded-xl bg-white p-4">
                            <GroupQRCode
                                groupId={group.groupId}
                                relayUrl={group.relayUrl}
                                groupName={state.metadata?.name || group.displayName}
                                roomKeyHex={roomKeyHex}
                            />
                        </div>
                        <Button
                            type="button"
                            className="w-full rounded-lg bg-violet-600 hover:bg-violet-500"
                            onClick={() => {
                                const url = `${toAbsoluteAppUrl(getPublicGroupHref(group.groupId, group.relayUrl))}${roomKeyHex ? `#k=${roomKeyHex}` : ""}`;
                                void navigator.clipboard.writeText(url);
                                toast.success("Join link copied");
                            }}
                        >
                            <Share2 className="mr-2 h-4 w-4" />
                            Copy join link
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <InviteMemberDialog
                isOpen={isInviteModalOpen}
                onClose={() => setIsInviteModalOpen(false)}
                groupId={group.groupId}
                relayUrl={group.relayUrl}
                roomKeyHex={roomKeyHex || ""}
                communityId={group.communityId}
                genesisEventId={group.genesisEventId}
                creatorPubkey={group.creatorPubkey}
                currentMemberPubkeys={inviteEligibleMemberPubkeys}
                metadata={{
                    id: group.groupId,
                    name: resolveCommunityDisplayName({
                        metadataName: state.metadata?.name,
                        persistedDisplayName: group.displayName,
                        groupId: group.groupId,
                        communityId: group.communityId,
                        fallback: group.displayName,
                    }),
                    about: state.metadata?.about || "",
                    picture: state.metadata?.picture || "",
                    access: state.metadata?.access || "invite-only",
                }}
            />
        </>
    );
}
