"use client";

import React, { useState } from "react";
import { Button } from "@dweb/ui-kit";
import { ShieldCheck, Users, Clock, AlertTriangle } from "lucide-react";
import { CommunityInviteStatusBanner } from "./community-invite-status-banner";
import { useTranslation } from "react-i18next";
import { toast } from "@dweb/ui-kit";
import { roomKeyStore } from "@/app/features/crypto/room-key-store";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { useRelay } from "@/app/features/relays/providers/relay-provider";
import { useRelayList } from "@/app/features/relays/hooks/use-relay-list";
import { useGroups } from "@/app/features/groups/providers/group-provider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@dweb/ui-kit";
import { cn } from "@dweb/ui-kit";
import type { GroupConversation, Message, SendDirectMessageParams, SendDirectMessageResult } from "@/app/features/messaging/types";
import type { GroupAccessMode } from "../types";
import { toGroupConversationId } from "../utils/group-conversation-id";
import { deriveCommunityId } from "../utils/community-identity";
import { dispatchGroupInviteReceived } from "@/app/features/profiles/services/profile-bus-dispatch";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { reinstateCommunityMemberTerminalEvidence } from "../services/community-terminal-membership-cache";
import {
    normalizeCommunityInvitePayload,
    type InvitePayload,
} from "../utils/community-invite-payload";
import {
    resolveCommunityInvitePayloadFromMessage,
    resolveCommunityInviteReplyTargetId,
    resolveCommunityInviteRoomKeyHex,
    resolveCommunityInviteIdFromMessage,
} from "../utils/community-invite-resolution";
import type { CommunityDmInviteId } from "../services/community-dm-invite-contract";
import {
    buildCommunityInviteResponseDmMessage,
    commitCommunityDmInviteResponseDm,
    parseInvitePayloadFromMessageContent,
    recordCommunityDmInviteResponse,
} from "../services/community-dm-invite-pipeline";
import {
    applyCommunityInviteMessageSnapshot,
    COMMUNITY_INVITE_SNAPSHOT_PINNED_EVENT,
} from "../utils/community-invite-message-snapshot";
import {
    PLACEHOLDER_GROUP_DISPLAY_NAME,
    resolveCommunityDisplayName,
} from "../services/community-display-name";
import {
    isCommunityInviteActionableStatus,
    isCommunityInviteHistoricalStatus,
    resolveCommunityInviteCardStatus,
    type CommunityInviteCardStatus,
} from "../utils/community-invite-lifecycle";
import { assessWorkspaceCommunityTrustAsync } from "../services/community-trust-policy";
import {
    ensureWorkspaceMembershipSyncMode,
    publishWorkspaceMemberJoin,
} from "../services/community-workspace-membership";
import { applyCommunityMembershipRuntimeEvidence } from "../services/community-membership-mutation-owner";
import { loadCommunityMembershipLedger } from "../services/community-membership-ledger";
import { loadGroupTombstones } from "../services/group-tombstone-store";
import {
    loadInviteRelayJoinState,
    publishCommunityInviteRelayJoin,
    resolveRelayJoinStatusAfterManualRetry,
    saveInviteRelayJoinState,
    shouldShowInviteRelayJoinRetry,
    type CommunityInviteRelayJoinStatus,
    type RelayScopedPublishFn,
} from "../services/community-invite-relay-join";
import { toScopedRelayUrl } from "../services/sealed-community-relay-scope";

export type { InvitePayload };

interface CommunityInviteCardProps {
    invite: InvitePayload;
    isOutgoing: boolean;
    message?: Message;
    messages?: ReadonlyArray<Message>;
    responseStatus?: 'pending' | 'accepted' | 'declined' | 'canceled';
    onSendDirectMessage?: (params: SendDirectMessageParams) => Promise<SendDirectMessageResult>;
}

export const CommunityInviteCard = ({
    invite: inviteProp,
    isOutgoing,
    message,
    messages = [],
    responseStatus,
    onSendDirectMessage
}: CommunityInviteCardProps) => {
    const [inviteSnapshotTick, setInviteSnapshotTick] = React.useState(0);
    React.useEffect(() => {
        if (typeof window === "undefined" || !message?.id) {
            return;
        }
        const onPinned = (event: Event): void => {
            const detail = (event as CustomEvent<{ messageId?: string }>).detail;
            if (detail?.messageId === message.id) {
                setInviteSnapshotTick((tick) => tick + 1);
            }
        };
        window.addEventListener(COMMUNITY_INVITE_SNAPSHOT_PINNED_EVENT, onPinned);
        return () => window.removeEventListener(COMMUNITY_INVITE_SNAPSHOT_PINNED_EVENT, onPinned);
    }, [message?.id]);
    const invite = React.useMemo(() => {
        const resolved = resolveCommunityInvitePayloadFromMessage(message, inviteProp)
            ?? normalizeCommunityInvitePayload(inviteProp)
            ?? inviteProp;
        return applyCommunityInviteMessageSnapshot(message?.id, resolved) ?? resolved;
    }, [inviteProp, message, inviteSnapshotTick]);
    const [storedRoomKeyHex, setStoredRoomKeyHex] = useState("");
    React.useEffect(() => {
        let cancelled = false;
        void roomKeyStore.getRoomKey(invite.groupId).then((value) => {
            if (!cancelled) {
                setStoredRoomKeyHex(value?.trim() ?? "");
            }
        });
        return () => {
            cancelled = true;
        };
    }, [invite.groupId]);
    const roomKeyHex = React.useMemo(() => {
        const fromInvite = resolveCommunityInviteRoomKeyHex(invite, message);
        return fromInvite || storedRoomKeyHex;
    }, [invite, message, storedRoomKeyHex]);
    const { t } = useTranslation();
    const { state: identityState } = useIdentity();
    const { relayPool } = useRelay();
    const relayList = useRelayList({ publicKeyHex: identityState.publicKeyHex || null });
    const { createdGroups, addGroup, recordMembershipLedgerAfterInviteDecline } = useGroups();
    const [isProcessing, setIsProcessing] = useState(false);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [localResolutionStatus, setLocalResolutionStatus] = useState<
        'accepted' | 'declined' | 'canceled' | null
    >(null);
    const inviteCardIdentity = React.useMemo(
        () => `${message?.id ?? "no-message"}:${message?.eventId ?? "no-event"}:${invite.groupId}`,
        [invite.groupId, message?.eventId, message?.id],
    );
    React.useEffect(() => {
        // Prevent status bleed when React reuses a card instance for a different invite row.
        setLocalResolutionStatus(null);
    }, [inviteCardIdentity]);

    const status = React.useMemo(() => {
        if (localResolutionStatus) {
            return localResolutionStatus;
        }
        if (!message) {
            return responseStatus && responseStatus !== "pending" ? responseStatus : "pending";
        }
        return resolveCommunityInviteCardStatus({
            message,
            messages,
            responseStatus,
        });
    }, [localResolutionStatus, message, messages, responseStatus]);
    const isHistorical = isCommunityInviteHistoricalStatus(status);
    const isActionable = isCommunityInviteActionableStatus(status);
    const persistedGroup = React.useMemo(
        () => createdGroups.find((group) => (
            group.kind === "group"
            && group.groupId === invite.groupId
            && (!invite.relayUrl || group.relayUrl === invite.relayUrl)
        )),
        [createdGroups, invite.groupId, invite.relayUrl],
    );
    const inviteDisplayName = React.useMemo(
        () => resolveCommunityDisplayName({
            metadataName: invite.metadata.name,
            persistedDisplayName: persistedGroup?.displayName,
            groupId: invite.groupId,
            communityId: invite.communityId,
            fallback: PLACEHOLDER_GROUP_DISPLAY_NAME,
        }),
        [invite.communityId, invite.groupId, invite.metadata.name, persistedGroup?.displayName],
    );
    const resolvedInviteIdForRelay = React.useMemo(
        () => resolveCommunityInviteIdFromMessage(message),
        [message],
    );
    const [relayJoinState, setRelayJoinState] = React.useState(() => (
        resolvedInviteIdForRelay
            ? loadInviteRelayJoinState(resolvedInviteIdForRelay)
            : { status: "not_attempted" as const, manualRetryCount: 0, updatedAtUnixMs: 0 }
    ));
    React.useEffect(() => {
        if (resolvedInviteIdForRelay) {
            setRelayJoinState(loadInviteRelayJoinState(resolvedInviteIdForRelay));
        }
    }, [resolvedInviteIdForRelay, inviteSnapshotTick]);

    const showRetryJoin = shouldShowInviteRelayJoinRetry(status, relayJoinState, isOutgoing);
    const showRelayJoinTerminalFailed = (
        !isOutgoing
        && status === "accepted"
        && relayJoinState.status === "terminal_failed"
    );
    const isInviteDefective = !isOutgoing && isActionable && roomKeyHex.length === 0;
    const normalizeRelayUrlForJoin = (raw: string): string => {
        const trimmed = raw.trim();
        if (!trimmed) {
            return "";
        }
        if (/^wss?:\/\//i.test(trimmed)) {
            return toScopedRelayUrl(trimmed) ?? trimmed;
        }
        // Local dev relays must stay ws://; default to wss:// for non-local hosts.
        const localHostPattern = /^(localhost|127(?:\.\d{1,3}){3}|\[::1\])(?::\d+)?$/i;
        const withScheme = localHostPattern.test(trimmed)
            ? `ws://${trimmed}`
            : `wss://${trimmed}`;
        return toScopedRelayUrl(withScheme) ?? withScheme;
    };

    const createScopedRelayPublisher = (targetRelay: string): RelayScopedPublishFn => (
        async (payload: string) => {
            try {
                if (targetRelay.length > 0 && typeof relayPool.publishToUrls === "function") {
                    const result = await relayPool.publishToUrls([targetRelay], payload);
                    return result.success;
                }
                if (targetRelay.length > 0 && typeof relayPool.publishToUrl === "function") {
                    const result = await relayPool.publishToUrl(targetRelay, payload);
                    return result.success;
                }
                if (targetRelay.length > 0 && typeof relayPool.publishToRelay === "function") {
                    const result = await relayPool.publishToRelay(targetRelay, payload);
                    return result.success;
                }
                const result = await relayPool.publishToAll(payload);
                return result.success;
            } catch {
                return false;
            }
        }
    );

    const publishInviteRelayJoin = async (
        targetRelay: string,
        roomKeyToUse: string,
    ): Promise<CommunityInviteRelayJoinStatus> => {
        if (!identityState.publicKeyHex?.trim() || !identityState.privateKeyHex?.trim()) {
            return "retry_scheduled";
        }
        const GroupServiceModule = await import("../services/group-service");
        const groupService = new GroupServiceModule.GroupService(
            identityState.publicKeyHex,
            identityState.privateKeyHex,
        );
        const nip29Join = await groupService.sendNip29Join({ groupId: invite.groupId });
        const sealedJoin = await groupService.sendSealedJoin({
            groupId: invite.groupId,
            roomKeyHex: roomKeyToUse,
        });
        const publish = createScopedRelayPublisher(targetRelay);
        const relayStatus = await publishCommunityInviteRelayJoin({
            publish,
            nip29JoinJson: JSON.stringify(["EVENT", nip29Join]),
            sealedJoinJson: JSON.stringify(["EVENT", sealedJoin]),
        });
        if (resolvedInviteIdForRelay) {
            const nextState = {
                status: relayStatus,
                manualRetryCount: 0,
                updatedAtUnixMs: Date.now(),
            };
            saveInviteRelayJoinState(resolvedInviteIdForRelay, nextState);
            setRelayJoinState(nextState);
        }
        return relayStatus;
    };

    const handleRelayJoinRetry = async (): Promise<void> => {
        if (!message || !showRetryJoin) {
            return;
        }
        let roomKeyToUse = roomKeyHex;
        if (!roomKeyToUse) {
            roomKeyToUse = (await roomKeyStore.getRoomKey(invite.groupId))?.trim() ?? "";
        }
        if (!roomKeyToUse) {
            toast.error(t("groups.inviteMissingRoomKey", "This invitation is missing encryption keys. Ask the sender to resend the invite."));
            return;
        }
        const fallbackRelay = relayPool.connections.find((c: { url: string }) => c.url)?.url ?? "";
        const scopedRelayUrl = (invite.relayUrl || fallbackRelay).trim();
        const targetRelay = normalizeRelayUrlForJoin(scopedRelayUrl);
        try {
            setIsProcessing(true);
            if (targetRelay.length > 0) {
                relayList.addRelay({ url: targetRelay });
                if (typeof relayPool.addTransientRelay === "function") {
                    relayPool.addTransientRelay(targetRelay);
                }
                if (typeof relayPool.waitForScopedConnection === "function") {
                    await relayPool.waitForScopedConnection([targetRelay], 3000);
                }
            }
            const GroupServiceModule = await import("../services/group-service");
            const groupService = new GroupServiceModule.GroupService(
                identityState.publicKeyHex!,
                identityState.privateKeyHex!,
            );
            const nip29Join = await groupService.sendNip29Join({ groupId: invite.groupId });
            const sealedJoin = await groupService.sendSealedJoin({
                groupId: invite.groupId,
                roomKeyHex: roomKeyToUse,
            });
            const publish = createScopedRelayPublisher(targetRelay);
            const publishSucceeded = (await publishCommunityInviteRelayJoin({
                publish,
                nip29JoinJson: JSON.stringify(["EVENT", nip29Join]),
                sealedJoinJson: JSON.stringify(["EVENT", sealedJoin]),
            })) === "joined";
            let nextState = relayJoinState;
            if (resolvedInviteIdForRelay) {
                nextState = resolveRelayJoinStatusAfterManualRetry(
                    publishSucceeded,
                    relayJoinState,
                );
                saveInviteRelayJoinState(resolvedInviteIdForRelay, nextState);
                setRelayJoinState(nextState);
            }
            if (publishSucceeded) {
                toast.success(t(
                    "groups.inviteRelayJoinComplete",
                    "Community relay join published. Open the group from Network when it appears.",
                ));
            } else if (nextState.status === "terminal_failed") {
                toast.error(t(
                    "groups.inviteRelayJoinTerminalFailed",
                    "Relay join still failed after retries. Check Settings → Relays for {{relay}}.",
                    { relay: invite.relayUrl || targetRelay || "unknown" },
                ));
            } else {
                toast.error(t(
                    "groups.inviteRelayPublishFailed",
                    "Could not reach the community relay ({{relay}}). Add it under Settings → Relays, then tap Complete join on relay.",
                    { relay: invite.relayUrl || targetRelay || "unknown" },
                ));
            }
        } finally {
            setIsProcessing(false);
        }
    };

    const handleAccept = async () => {
        if (!isActionable || !message || !onSendDirectMessage) return;
        if (!identityState.publicKeyHex?.trim() || !identityState.privateKeyHex?.trim()) {
            toast.error(t("groups.inviteUnlockIdentity", "Unlock your identity before joining a community."));
            return;
        }
        const fallbackRelay = relayPool.connections.find((c: { url: string }) => c.url)?.url ?? "";
        const scopedRelayUrl = (invite.relayUrl || fallbackRelay).trim();
        const trust = await assessWorkspaceCommunityTrustAsync({
            communityRelayUrl: scopedRelayUrl,
            enabledRelayUrls: relayList.state.relays.map((relay) => relay.url),
        });
        if (!trust.allowed) {
            toast.error(trust.userMessage);
            return;
        }
        ensureWorkspaceMembershipSyncMode();
        let roomKeyToUse = roomKeyHex;
        if (!roomKeyToUse) {
            roomKeyToUse = (await roomKeyStore.getRoomKey(invite.groupId))?.trim() ?? "";
        }
        if (!roomKeyToUse) {
            toast.error(t("groups.inviteMissingRoomKey", "This invitation is missing encryption keys. Ask the sender to resend the invite."));
            return;
        }
        try {
            setIsProcessing(true);
            await roomKeyStore.saveRoomKey(invite.groupId, roomKeyToUse);

            // Prefer the relay URL embedded in the invite. Fall back to the first
            // open relay in the pool rather than a hardcoded address.
            const relayUrl = normalizeRelayUrlForJoin(scopedRelayUrl);
            const creatorPubkey = invite.creatorPubkey ?? message.senderPubkey;
            const genesisEventId = invite.genesisEventId ?? message.eventId ?? message.id;
            const communityId = deriveCommunityId({
                existingCommunityId: invite.communityId,
                groupId: invite.groupId,
                relayUrl,
                genesisEventId,
                creatorPubkey
            });
            const accessMode: GroupAccessMode =
                invite.metadata.access === "discoverable"
                    ? "discoverable"
                    : invite.metadata.access === "invite-only" || invite.metadata.access === "private"
                        ? "invite-only"
                        : "open";

            const newGroup: GroupConversation = {
                kind: 'group',
                id: toGroupConversationId({ groupId: invite.groupId, relayUrl, communityId }),
                communityId,
                creatorPubkey,
                genesisEventId,
                groupId: invite.groupId,
                relayUrl: relayUrl,
                displayName: inviteDisplayName,
                memberPubkeys: [
                    identityState.publicKeyHex || "",
                    message.senderPubkey || ""
                ].filter(Boolean) as string[],
                adminPubkeys: [message.senderPubkey || ""],
                lastMessage: t("groups.joined", "Joined private encrypted group"),
                unreadCount: 1,
                lastMessageTime: new Date(),
                access: accessMode,
                memberCount: 2,
                avatar: invite.metadata.picture
            };

            const targetRelay = relayUrl.trim();
            if (targetRelay.length > 0) {
                relayList.addRelay({ url: targetRelay });
                if (typeof relayPool.addTransientRelay === "function") {
                    relayPool.addTransientRelay(targetRelay);
                }
            }
            if (targetRelay.length > 0 && typeof relayPool.waitForScopedConnection === "function") {
                await relayPool.waitForScopedConnection([targetRelay], 3000);
            } else if (typeof relayPool.waitForConnection === "function") {
                await relayPool.waitForConnection(3000);
            }

            const relayStatus = await publishInviteRelayJoin(targetRelay, roomKeyToUse);
            const relayPublishFailed = relayStatus === "retry_scheduled";

            const profileId = getResolvedProfileId();
            const localPublicKeyHex = identityState.publicKeyHex?.trim();
            if (localPublicKeyHex) {
                applyCommunityMembershipRuntimeEvidence({
                    publicKeyHex: localPublicKeyHex,
                    profileId,
                    evidence: {
                        kind: "user_explicit_join",
                        group: newGroup,
                    },
                    membershipLedger: loadCommunityMembershipLedger(localPublicKeyHex, { profileId }),
                    tombstones: loadGroupTombstones(localPublicKeyHex, { profileId }),
                });
            }
            addGroup(newGroup, { allowRevive: true });
            dispatchGroupInviteReceived(newGroup);

            const joinCoordination = await publishWorkspaceMemberJoin({
                communityId,
                memberPubkey: identityState.publicKeyHex as PublicKeyHex,
                actorPubkey: identityState.publicKeyHex as PublicKeyHex,
                actorPrivateKeyHex: identityState.privateKeyHex as PrivateKeyHex,
            });
            if (!joinCoordination.success) {
                toast.error(t(
                    "groups.coordinationJoinPublishFailed",
                    "Joined locally, but coordination membership publish failed. Open the community and use Reconcile membership after coordination is online.",
                ));
            }

            if (relayUrl) {
                reinstateCommunityMemberTerminalEvidence({
                    groupId: invite.groupId,
                    relayUrl,
                    memberPubkeys: [
                        identityState.publicKeyHex || "",
                        message.senderPubkey || "",
                    ].filter(Boolean),
                    profileId: getResolvedProfileId(),
                });
            }

            const inviteId = resolveCommunityInviteIdFromMessage(message);
            const wireInvite = parseInvitePayloadFromMessageContent(message.content);
            const resolvedInviteId = inviteId ?? (`legacy:${invite.groupId}` as CommunityDmInviteId);
            const responseMessage = buildCommunityInviteResponseDmMessage({
                inviteId: resolvedInviteId,
                status: "accepted",
                groupId: invite.groupId,
                relayUrl,
                communityId,
                conversationId: message.conversationId?.trim() ?? "",
                senderPubkey: identityState.publicKeyHex as PublicKeyHex,
                recipientPubkey: (message.senderPubkey?.trim() ?? "") as PublicKeyHex,
                replyToRumorEventId: resolveCommunityInviteReplyTargetId(message),
            });
            const sendResult = await onSendDirectMessage({
                recipientPubkey: message.senderPubkey || "",
                content: responseMessage.content,
                replyTo: resolveCommunityInviteReplyTargetId(message),
            });
            if (sendResult.success && identityState.publicKeyHex?.trim()) {
                await commitCommunityDmInviteResponseDm({
                    responseMessage: sendResult.messageId
                        ? { ...responseMessage, id: sendResult.messageId }
                        : responseMessage,
                    accountPublicKeyHex: identityState.publicKeyHex as PublicKeyHex,
                    direction: "inbound",
                    invitePayload: wireInvite ?? undefined,
                });
            } else if (inviteId && message.conversationId?.trim() && message.senderPubkey?.trim()) {
                recordCommunityDmInviteResponse({
                    inviteId,
                    status: "accepted",
                    conversationId: message.conversationId.trim(),
                    peerPubkey: message.senderPubkey.trim() as PublicKeyHex,
                    direction: "inbound",
                    invitePayload: wireInvite ?? undefined,
                });
            }

            setLocalResolutionStatus("accepted");
            if (relayPublishFailed) {
                toast.error(t(
                    "groups.inviteRelayPublishFailed",
                    "Could not reach the community relay ({{relay}}). Add it under Settings → Relays, then tap Complete join on relay.",
                    { relay: invite.relayUrl || relayUrl || "unknown" },
                ));
            } else {
                toast.success(t(
                    "groups.inviteAcceptedRelayHonest",
                    "Acceptance recorded for {{name}}. Relay-visible membership may still lag—verify participants when needed.",
                    { name: inviteDisplayName },
                ));
            }
        } catch (error) {
            console.error("Failed to accept invite:", error);
            const messageText = error instanceof Error ? error.message : String(error);
            if (messageText.includes("Could not publish community join")) {
                toast.error(t(
                    "groups.inviteRelayPublishFailed",
                    "Could not reach the community relay ({{relay}}). Add it under Settings → Relays, then tap Complete join on relay.",
                    { relay: invite.relayUrl || "unknown" },
                ));
            } else if (messageText.toLowerCase().includes("secret") || messageText.toLowerCase().includes("key")) {
                toast.error(t("groups.inviteError", "Failed to join group. Secret key error."));
            } else {
                toast.error(t(
                    "groups.inviteAcceptFailed",
                    "Could not complete join: {{reason}}",
                    { reason: messageText.slice(0, 120) },
                ));
            }
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDecline = async () => {
        if (!isActionable || !message || !onSendDirectMessage) return;
        try {
            setIsProcessing(true);
            const inviteId = resolveCommunityInviteIdFromMessage(message);
            const wireInvite = parseInvitePayloadFromMessageContent(message.content);
            const resolvedInviteId = inviteId ?? (`legacy:${invite.groupId}` as CommunityDmInviteId);
            const responseMessage = buildCommunityInviteResponseDmMessage({
                inviteId: resolvedInviteId,
                status: "declined",
                groupId: invite.groupId,
                relayUrl: invite.relayUrl,
                communityId: invite.communityId,
                conversationId: message.conversationId?.trim() ?? "",
                senderPubkey: identityState.publicKeyHex as PublicKeyHex,
                recipientPubkey: (message.senderPubkey?.trim() ?? "") as PublicKeyHex,
                replyToRumorEventId: resolveCommunityInviteReplyTargetId(message),
            });
            const sendResult = await onSendDirectMessage({
                recipientPubkey: message.senderPubkey || "",
                content: responseMessage.content,
                replyTo: resolveCommunityInviteReplyTargetId(message),
            });
            if (sendResult.success && identityState.publicKeyHex?.trim()) {
                await commitCommunityDmInviteResponseDm({
                    responseMessage: sendResult.messageId
                        ? { ...responseMessage, id: sendResult.messageId }
                        : responseMessage,
                    accountPublicKeyHex: identityState.publicKeyHex as PublicKeyHex,
                    direction: "inbound",
                    invitePayload: wireInvite ?? undefined,
                });
            } else if (inviteId && message.conversationId?.trim() && message.senderPubkey?.trim()) {
                recordCommunityDmInviteResponse({
                    inviteId,
                    status: "declined",
                    conversationId: message.conversationId.trim(),
                    peerPubkey: message.senderPubkey.trim() as PublicKeyHex,
                    direction: "inbound",
                    invitePayload: wireInvite ?? undefined,
                });
            }

            const fallbackRelay = relayPool.connections.find((c: { url: string }) => c.url)?.url ?? "";
            const relayUrl = (invite.relayUrl || fallbackRelay).trim();
            if (relayUrl.length > 0) {
                const creatorPubkey = invite.creatorPubkey ?? message.senderPubkey;
                const genesisEventId = invite.genesisEventId ?? message.eventId ?? message.id;
                const communityId = deriveCommunityId({
                    existingCommunityId: invite.communityId,
                    groupId: invite.groupId,
                    relayUrl,
                    genesisEventId,
                    creatorPubkey,
                });
                const accessMode: GroupAccessMode =
                    invite.metadata.access === "discoverable"
                        ? "discoverable"
                        : invite.metadata.access === "invite-only" || invite.metadata.access === "private"
                            ? "invite-only"
                            : "open";
                recordMembershipLedgerAfterInviteDecline({
                    kind: "group",
                    id: toGroupConversationId({ groupId: invite.groupId, relayUrl, communityId }),
                    communityId,
                    creatorPubkey,
                    genesisEventId,
                    groupId: invite.groupId,
                    relayUrl,
                    displayName: inviteDisplayName,
                    memberPubkeys: [
                        identityState.publicKeyHex || "",
                        message.senderPubkey || "",
                    ].filter(Boolean) as string[],
                    adminPubkeys: [message.senderPubkey || ""].filter(Boolean) as string[],
                    lastMessage: "",
                    unreadCount: 0,
                    lastMessageTime: new Date(),
                    access: accessMode,
                    memberCount: 2,
                    avatar: invite.metadata.picture,
                });
            }

            setLocalResolutionStatus("declined");
            toast.info(t("groups.inviteDeclined", "You declined the invitation to {{name}}", { name: inviteDisplayName }));
        } catch (error) {
            console.error("Failed to decline invite:", error);
            toast.error(t("groups.declineError", "Failed to send decline response."));
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCancel = async () => {
        if (!isActionable || !message || !onSendDirectMessage) return;
        try {
            setIsProcessing(true);

            // For older messages that might lack recipientPubkey, infer it from conversationId
            let targetPubkey = message.recipientPubkey;
            if (!targetPubkey && message.conversationId && message.senderPubkey) {
                const parts = message.conversationId.split(':');
                targetPubkey = parts.find(p => p !== message.senderPubkey) as any;
            }

            // Sender cancels the invite by sending a response back to the intended recipient
            // Since it's an outgoing message, the recipient is message.recipientPubkey
            const inviteId = resolveCommunityInviteIdFromMessage(message);
            const wireInvite = parseInvitePayloadFromMessageContent(message.content);
            const resolvedInviteId = inviteId ?? (`legacy:${invite.groupId}` as CommunityDmInviteId);
            const responseMessage = buildCommunityInviteResponseDmMessage({
                inviteId: resolvedInviteId,
                status: "canceled",
                groupId: invite.groupId,
                relayUrl: invite.relayUrl,
                communityId: invite.communityId,
                conversationId: message.conversationId?.trim() ?? "",
                senderPubkey: identityState.publicKeyHex as PublicKeyHex,
                recipientPubkey: (targetPubkey?.trim() ?? "") as PublicKeyHex,
                replyToRumorEventId: resolveCommunityInviteReplyTargetId(message),
            });
            const sendResult = await onSendDirectMessage({
                recipientPubkey: targetPubkey || "",
                content: responseMessage.content,
                replyTo: resolveCommunityInviteReplyTargetId(message),
            });
            if (sendResult.success && identityState.publicKeyHex?.trim()) {
                await commitCommunityDmInviteResponseDm({
                    responseMessage: sendResult.messageId
                        ? { ...responseMessage, id: sendResult.messageId }
                        : responseMessage,
                    accountPublicKeyHex: identityState.publicKeyHex as PublicKeyHex,
                    direction: "outbound",
                    invitePayload: wireInvite ?? undefined,
                });
            } else if (inviteId && message.conversationId?.trim() && targetPubkey?.trim()) {
                recordCommunityDmInviteResponse({
                    inviteId,
                    status: "canceled",
                    conversationId: message.conversationId.trim(),
                    peerPubkey: targetPubkey.trim() as PublicKeyHex,
                    direction: "outbound",
                    invitePayload: wireInvite ?? undefined,
                });
            }
            // Phase 3 M3: do not call recordMembershipLedgerAfterInviteDecline here — the inviter may still be
            // relay-joined as admin; cancel only withdraws the invite to the peer, not local membership exit.
            setLocalResolutionStatus("canceled");
            toast.success(t("groups.inviteCanceled", "Invitation canceled successfully"));
        } catch (error) {
            console.error("Failed to cancel invite:", error);
            toast.error(t("groups.cancelError", "Failed to cancel invitation."));
        } finally {
            setIsProcessing(false);
        }
    };

    const inviteCardShellClass = isOutgoing
        ? cn(
            "overflow-hidden border max-w-[320px] shadow-sm transition-all group/invite rounded-[32px]",
            isHistorical
                ? "cursor-default border-zinc-500/25 bg-zinc-900/85 text-zinc-300 opacity-90 ring-0"
                : "cursor-pointer border-surface-contrast bg-gradient-surface-contrast text-surface-contrast-primary hover:border-purple-500/50 ring-1 ring-purple-400/20 dark:ring-purple-400/15",
            isDetailsOpen && !isHistorical && "ring-2 ring-purple-500/30 border-purple-500/50",
        )
        : cn(
            "relative overflow-hidden max-w-[320px] transition-all group/invite rounded-[28px]",
            isHistorical
                ? "cursor-default border-zinc-300/50 bg-zinc-100/90 text-zinc-600 opacity-95 shadow-sm dark:border-zinc-600/40 dark:bg-zinc-900/80 dark:text-zinc-400"
                : "cursor-pointer border border-purple-300/55 bg-gradient-to-br from-purple-50 via-white to-indigo-50/90 text-foreground shadow-[0_10px_32px_rgba(88,28,135,0.14)] hover:border-purple-400/70 hover:shadow-[0_12px_36px_rgba(88,28,135,0.18)] dark:border-white/[0.07] dark:bg-gradient-to-br dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-900/95 dark:text-surface-contrast-primary dark:shadow-sm dark:shadow-black/25 dark:hover:border-purple-500/40",
            isDetailsOpen && !isHistorical && "ring-2 ring-purple-500/35 border-purple-400/70 dark:ring-purple-500/30 dark:border-purple-500/50",
        );

    const inviteTitleClass = isOutgoing
        ? "text-sm font-black truncate group-hover/invite:text-purple-600 dark:group-hover/invite:text-purple-400 text-surface-contrast-primary"
        : "text-sm font-black truncate text-zinc-900 group-hover/invite:text-purple-700 dark:text-surface-contrast-primary dark:group-hover/invite:text-purple-400";

    const inviteDescriptionClass = isOutgoing
        ? "text-[10px] line-clamp-2 mt-0.5 leading-relaxed text-surface-contrast-secondary"
        : "text-[10px] line-clamp-2 mt-0.5 leading-relaxed text-zinc-600 dark:text-surface-contrast-secondary";

    const inviteBadgeClass = isOutgoing
        ? "flex items-center gap-1.5 px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-black/5 dark:bg-white/5 text-surface-contrast-secondary"
        : "flex items-center gap-1.5 px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-purple-200/70 bg-purple-500/10 text-purple-900 dark:border-transparent dark:bg-white/5 dark:text-surface-contrast-secondary";

    return (
        <>
            <div
                data-testid="community-invite-card"
                data-invite-direction={isOutgoing ? "outgoing" : "incoming"}
                data-invite-lifecycle={isHistorical ? "historical" : isActionable ? "active" : "closed"}
                data-invite-status={status}
                onClick={() => setIsDetailsOpen(true)}
                className={inviteCardShellClass}
            >
                {!isOutgoing && !isHistorical ? (
                    <div
                        aria-hidden
                        className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-primary dark:hidden"
                    />
                ) : null}
                {isHistorical ? (
                    <div
                        aria-hidden
                        className={cn(
                            "pointer-events-none absolute inset-x-0 top-0 h-0.5",
                            isOutgoing ? "bg-zinc-500/40" : "bg-zinc-400/50 dark:bg-zinc-600/50",
                        )}
                    />
                ) : null}
                <div className="p-4 flex flex-col gap-4">
                    <div className="min-w-0 flex flex-col gap-1">
                        {!isOutgoing && isActionable ? (
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-purple-700 dark:text-purple-300">
                                {t("groups.newCommunityInvite", "New community invite")}
                            </span>
                        ) : null}
                        <h4 className={inviteTitleClass}>
                            {inviteDisplayName}
                        </h4>
                        <p className={inviteDescriptionClass}>
                            {invite.metadata.about || t("groups.privateInviteDesc", "You've been invited to join this private encrypted community.")}
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className={inviteBadgeClass}>
                            <ShieldCheck className="h-3 w-3" />
                            {t("groups.encrypted", "Encrypted")}
                        </div>
                        <div className={inviteBadgeClass}>
                            <Users className="h-3 w-3" />
                            {t("groups.private", "Private")}
                        </div>
                        {invite.metadata.memberCount !== undefined && (
                            <div className={cn(
                                "ml-auto text-[9px] font-bold",
                                isOutgoing ? "text-surface-contrast-secondary opacity-80" : "text-zinc-600 dark:text-surface-contrast-secondary dark:opacity-80"
                            )}>
                                {invite.metadata.memberCount} {t("groups.members", "members")}
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-2 pt-1">
                        {isInviteDefective ? (
                            <div
                                role="status"
                                data-testid="community-invite-defective-banner"
                                className="flex w-full flex-col items-center justify-center gap-1 rounded-[22px] border border-amber-400/70 bg-gradient-to-r from-amber-50 via-white to-amber-50/80 px-4 py-3 text-center shadow-sm dark:border-amber-500/40 dark:from-amber-950/80 dark:via-zinc-950 dark:to-zinc-950"
                            >
                                <div className="flex items-center justify-center gap-2 text-amber-900 dark:text-amber-200">
                                    <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
                                    <span className="text-[10px] font-black uppercase tracking-[0.15em]">
                                        {t("groups.inviteDefectiveTitle", "Invitation incomplete")}
                                    </span>
                                </div>
                                <p className="max-w-[28rem] text-[11px] font-medium leading-snug text-amber-800/90 dark:text-amber-200/90">
                                    {t(
                                        "groups.inviteDefectiveHint",
                                        "This invite was sent without encryption keys. Ask {{name}} to send a new invitation from the community page.",
                                        { name: inviteDisplayName },
                                    )}
                                </p>
                            </div>
                        ) : null}
                        {isActionable && !isInviteDefective ? (
                            isOutgoing ? (
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-surface-contrast-secondary opacity-90">
                                        <Clock className="h-3 w-3" />
                                        {t("groups.pending", "Pending Response")}
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        disabled={isProcessing}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleCancel();
                                        }}
                                        className="h-9 rounded-xl text-[10px] uppercase font-black tracking-widest border border-surface-contrast bg-white/50 text-surface-contrast-primary hover:bg-white/70 dark:bg-white/5 dark:hover:bg-white/10 transition-colors"
                                    >
                                        {isProcessing ? t("common.processing", "Processing...") : t("common.cancelInvite", "Cancel Invitation")}
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    <Button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleAccept();
                                        }}
                                        disabled={isProcessing}
                                        className="flex-1 h-10 bg-gradient-primary text-primary-foreground font-bold rounded-xl shadow-lg shadow-purple-600/25 transition-all hover:opacity-95 hover:scale-[1.02] active:scale-95"
                                    >
                                        {isProcessing ? t("common.processing", "Processing...") : t("common.accept", "Accept")}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="flex-1 h-10 font-bold rounded-xl border-zinc-300/80 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300 dark:hover:bg-white/10 transition-all active:scale-95"
                                        disabled={isProcessing}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDecline();
                                        }}
                                    >
                                        {t("common.decline", "Decline")}
                                    </Button>
                                </div>
                            )
                        ) : !isActionable ? (
                            <div className="flex flex-col gap-2">
                                <CommunityInviteStatusBanner
                                    status={status}
                                    isOutgoing={isOutgoing}
                                    compact={status !== "accepted"}
                                />
                                {showRelayJoinTerminalFailed ? (
                                    <p className="text-center text-[11px] font-medium leading-snug text-amber-700 dark:text-amber-200/90">
                                        {t(
                                            "groups.inviteRelayJoinTerminalFailed",
                                            "Relay join still failed after retries. Check Settings → Relays for {{relay}}.",
                                            { relay: invite.relayUrl || "unknown" },
                                        )}
                                    </p>
                                ) : null}
                                {showRetryJoin ? (
                                    <Button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            void handleRelayJoinRetry();
                                        }}
                                        disabled={isProcessing}
                                        className="h-10 w-full rounded-xl bg-gradient-primary font-bold text-primary-foreground shadow-lg shadow-purple-600/25"
                                    >
                                        {isProcessing
                                            ? t("common.processing", "Processing...")
                                            : t("groups.inviteRetryJoin", "Complete join on relay")}
                                    </Button>
                                ) : null}
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>

            <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                <DialogContent className="sm:max-w-md bg-white dark:bg-zinc-900 border-zinc-200 dark:border-white/10 rounded-[28px] overflow-hidden p-0">
                    <div className="h-1.5 w-full bg-gradient-to-r from-purple-600 via-indigo-500 to-violet-500" aria-hidden />
                    <div className="pb-8 px-8 pt-8 space-y-6">
                        <DialogHeader className="space-y-2 text-left p-0">
                            <DialogTitle className="text-2xl font-black text-zinc-900 dark:text-white">
                                {inviteDisplayName}
                            </DialogTitle>
                            <DialogDescription className="text-zinc-500 font-bold text-xs uppercase tracking-widest">
                                {invite.metadata.access || "Private"} Community • {invite.metadata.memberCount || 0} Members
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-2">
                            <h5 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">About this community</h5>
                            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed font-medium bg-zinc-50 dark:bg-white/5 p-4 rounded-2xl border border-zinc-100 dark:border-white/5">
                                {invite.metadata.about || "No description provided for this group."}
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/5 text-center">
                                <ShieldCheck className="h-6 w-6 text-emerald-500 mx-auto mb-2" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">End-to-End</span>
                                <p className="text-xs font-bold text-zinc-900 dark:text-white">Encrypted</p>
                            </div>
                            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/5 text-center">
                                <Users className="h-6 w-6 text-purple-500 mx-auto mb-2" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Status</span>
                                <p className="text-xs font-bold text-zinc-900 dark:text-white">Invitation Only</p>
                            </div>
                        </div>

                        {isActionable && !isInviteDefective && (
                            <div className="flex gap-3 pt-2">
                                <Button
                                    onClick={() => {
                                        handleAccept();
                                        setIsDetailsOpen(false);
                                    }}
                                    disabled={isProcessing}
                                    className="flex-1 h-14 bg-purple-600 hover:bg-purple-700 text-white font-black rounded-2xl shadow-xl shadow-purple-600/20"
                                >
                                    {isProcessing ? t("common.processing", "Processing...") : t("common.accept", "Accept Invitation")}
                                </Button>
                                <Button
                                    variant="ghost"
                                    className="flex-1 h-14 font-black rounded-2xl text-zinc-500 hover:bg-zinc-200 dark:hover:bg-white/5"
                                    disabled={isProcessing}
                                    onClick={() => {
                                        handleDecline();
                                        setIsDetailsOpen(false);
                                    }}
                                >
                                    {t("common.decline", "Decline")}
                                </Button>
                            </div>
                        )}

                        {!isActionable && (
                            <CommunityInviteStatusBanner
                                status={status}
                                isOutgoing={isOutgoing}
                                compact
                            />
                        )}
                        {status === "accepted" && showRetryJoin ? (
                            <Button
                                onClick={() => {
                                    void handleRelayJoinRetry();
                                    setIsDetailsOpen(false);
                                }}
                                disabled={isProcessing}
                                className="h-12 w-full rounded-2xl bg-gradient-primary font-bold text-primary-foreground"
                            >
                                {isProcessing
                                    ? t("common.processing", "Processing...")
                                    : t("groups.inviteRetryJoin", "Complete join on relay")}
                            </Button>
                        ) : null}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};

