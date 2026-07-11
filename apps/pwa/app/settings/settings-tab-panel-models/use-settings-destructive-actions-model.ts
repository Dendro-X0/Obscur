"use client";
import { useCallback, useEffect, useState } from "react";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { toast } from "@dweb/ui-kit";
import { useTranslation } from "react-i18next";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { useProfile } from "@/app/features/profile/hooks/use-profile";
import { useProfilePublisher } from "@/app/features/profile/hooks/use-profile-publisher";
import { useRelay } from "@/app/features/relays/providers/relay-provider";
import { useRelayPoolRef } from "@/app/features/relays/hooks/use-relay-pool-ref";
import { GroupService } from "@/app/features/groups/services/group-service";
import { loadCommunityMembershipLedger, selectJoinedCommunityMembershipLedgerEntries, } from "@/app/features/groups/services/community-membership-ledger";
import { persistExplicitCommunityMembershipLeave } from "@/app/features/groups/services/community-membership-coordinator";
import { enqueueCommunityLeaveOutboxItem, recordCommunityLeaveRelayPublishOutcome, } from "@/app/features/groups/services/community-leave-outbox";
import { toGroupConversationId } from "@/app/features/groups/utils/group-conversation-id";
import type { GroupConversation } from "@/app/features/messaging/types";
import { resetLocalHistoryKeepingIdentity } from "@/app/features/messaging/services/local-history-reset-service";
import { markRetiredIdentityPublicKey } from "@/app/features/auth/utils/retired-identity-registry";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { getDefaultProfileId } from "@/app/features/profiles/services/profile-scope";
import { desktopProfileRuntime, useDesktopProfileIsolationSnapshot } from "@/app/features/profiles/services/desktop-profile-runtime";
import {
  DELETE_PROFILE_WINDOW_CONFIRM_TEXT,
  deleteCurrentProfileWindowCompletely,
} from "@/app/features/profiles/services/delete-current-profile-window";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { performAccountSessionHardReset } from "@/app/features/runtime/services/account-session-hard-reset";
import { archiveAndClearProfileLocalDataKeepingIdentity } from "@/app/features/profiles/services/profile-session-lifecycle";
import { archiveProfileWorkspaceBeforeWipe } from "@/app/features/profiles/services/profile-workspace-archive-service";
import { wipeProfileWorkspaceCompletely } from "@/app/features/profiles/services/wipe-profile-workspace";
import { clearLastBoundAccountPublicKeyHex } from "@/app/features/profiles/services/profile-window-account-binding";
import type { ProfileWorkspaceArchiveWriteResult } from "@/app/features/profiles/services/profile-workspace-archive-contracts";
import { roomKeyStore } from "@/app/features/crypto/room-key-store";
import type { SettingsActionPhase } from "@/app/features/settings/components/settings-action-status";
import { DELETE_ACCOUNT_CONFIRM_TEXT, toScopedRelayUrlForDelete } from "../settings-tab-panel-shared";
export function useSettingsDestructiveActionsModel(): Record<string, unknown> {
    const { t } = useTranslation();
    const identity = useIdentity();
    const profile = useProfile();
    const { publishProfile } = useProfilePublisher();
    const { relayPool: pool, relayList } = useRelay();
    const poolRef = useRelayPoolRef(pool);
    const displayPublicKeyHex: string = identity.state.publicKeyHex ?? identity.state.stored?.publicKeyHex ?? "";
    const publicKeyHex: PublicKeyHex | null = (displayPublicKeyHex as PublicKeyHex | null) ?? null;
    const [deleteAccountConfirmInput, setDeleteAccountConfirmInput] = useState<string>("");
    const [deleteAccountCountdown, setDeleteAccountCountdown] = useState<number>(0);
    const [securityActionPhase, setSecurityActionPhase] = useState<SettingsActionPhase>("idle");
    const [securityActionMessage, setSecurityActionMessage] = useState<string>("");
    const [storageActionPhase, setStorageActionPhase] = useState<SettingsActionPhase>("idle");
    const [storageActionMessage, setStorageActionMessage] = useState<string>("");
    const [isClearDataDialogOpen, setIsClearDataDialogOpen] = useState(false);
    const [isResetLocalHistoryDialogOpen, setIsResetLocalHistoryDialogOpen] = useState(false);
    const [isDeleteAccountDialogOpen, setIsDeleteAccountDialogOpen] = useState(false);
    const [isDisableAllRelaysDialogOpen, setIsDisableAllRelaysDialogOpen] = useState(false);
    const [profileArchiveResult, setProfileArchiveResult] = useState<ProfileWorkspaceArchiveWriteResult | null>(null);
    const [isProfileArchiveDialogOpen, setIsProfileArchiveDialogOpen] = useState(false);
    const [profileArchiveDialogMode, setProfileArchiveDialogMode] = useState<"clear_data" | "delete_account" | "delete_profile_window">("clear_data");
    const [isDeleteProfileWindowDialogOpen, setIsDeleteProfileWindowDialogOpen] = useState(false);
    const [deleteProfileWindowConfirmInput, setDeleteProfileWindowConfirmInput] = useState("");
    const desktopSnapshot = useDesktopProfileIsolationSnapshot();
    const resolvedProfileId = getResolvedProfileId();
    const isDefaultProfileWindow = resolvedProfileId === getDefaultProfileId();
    const clearIndexedDbDatabases = async (): Promise<void> => {
        return;
    };
    const clearRuntimeCaches = async (): Promise<void> => {
        if (typeof window === "undefined") {
            return;
        }
        if ("caches" in window) {
            try {
                const cacheKeys = await caches.keys();
                await Promise.all(cacheKeys.map((cacheKey) => caches.delete(cacheKey)));
            }
            catch {
                // Best-effort cache cleanup
            }
        }
        if ("serviceWorker" in navigator) {
            try {
                const registrations = await navigator.serviceWorker.getRegistrations();
                await Promise.all(registrations.map((registration) => registration.unregister()));
            }
            catch {
                // Best-effort service worker cleanup
            }
        }
    };
    const publishScopedGroupEvent = useCallback(async (params: Readonly<{
        relayUrl: string;
        event: unknown;
    }>): Promise<boolean> => {
        const relayPool = poolRef.current;
        const payload = JSON.stringify(["EVENT", params.event]);
        const scopedRelayUrl = toScopedRelayUrlForDelete(params.relayUrl);
        if (!scopedRelayUrl) {
            const fallbackResult = await relayPool.publishToAll(payload);
            return fallbackResult.success;
        }
        if (typeof relayPool.publishToUrls === "function") {
            const scopedResult = await relayPool.publishToUrls([scopedRelayUrl], payload);
            return scopedResult.success;
        }
        if (typeof relayPool.publishToUrl === "function") {
            const scopedResult = await relayPool.publishToUrl(scopedRelayUrl, payload);
            return scopedResult.success;
        }
        if (typeof relayPool.publishToRelay === "function") {
            const scopedResult = await relayPool.publishToRelay(scopedRelayUrl, payload);
            return scopedResult.success;
        }
        const fallbackResult = await relayPool.publishToAll(payload);
        return fallbackResult.success;
    }, [poolRef]);
    const leaveJoinedCommunitiesBeforeAccountDeletion = useCallback(async (): Promise<Readonly<{
        joinedCount: number;
        leftPublishedCount: number;
        leftPublishFailureCount: number;
    }>> => {
        if (!publicKeyHex || !identity.state.privateKeyHex) {
            return { joinedCount: 0, leftPublishedCount: 0, leftPublishFailureCount: 0 };
        }
        const ledgerEntries = loadCommunityMembershipLedger(publicKeyHex);
        const joinedEntries = selectJoinedCommunityMembershipLedgerEntries(ledgerEntries);
        if (joinedEntries.length === 0) {
            return { joinedCount: 0, leftPublishedCount: 0, leftPublishFailureCount: 0 };
        }
        const groupService = new GroupService(publicKeyHex, identity.state.privateKeyHex as PrivateKeyHex);
        let leftPublishedCount = 0;
        let leftPublishFailureCount = 0;
        for (const entry of joinedEntries) {
            const groupId = entry.groupId.trim();
            const relayUrl = entry.relayUrl?.trim() ?? "";
            if (groupId.length === 0 || relayUrl.length === 0) {
                leftPublishFailureCount += 1;
                continue;
            }
            enqueueCommunityLeaveOutboxItem({
                publicKeyHex,
                groupId,
                relayUrl,
                communityId: entry.communityId,
            });
            const group: GroupConversation = {
                kind: "group",
                id: toGroupConversationId({ groupId, relayUrl, communityId: entry.communityId }),
                communityId: entry.communityId,
                groupId,
                relayUrl,
                displayName: entry.displayName ?? "Private Group",
                memberPubkeys: entry.memberPubkeys ?? [publicKeyHex],
                lastMessage: "",
                unreadCount: 0,
                lastMessageTime: new Date(entry.updatedAtUnixMs ?? Date.now()),
                access: "invite-only",
                memberCount: Math.max(1, entry.memberPubkeys?.length ?? 1),
                adminPubkeys: entry.adminPubkeys ?? [],
                avatar: entry.avatar,
            };
            persistExplicitCommunityMembershipLeave({
                publicKeyHex,
                group,
                updatedAtUnixMs: Date.now(),
                lastEvidenceEventId: entry.lastEvidenceEventId,
            });
            let nip29LeavePublished = false;
            let sealedLeavePublished = true;
            try {
                const nip29Leave = await groupService.sendNip29Leave({ groupId });
                nip29LeavePublished = await publishScopedGroupEvent({ relayUrl, event: nip29Leave });
            }
            catch {
                nip29LeavePublished = false;
            }
            try {
                const roomKeyHex = await roomKeyStore.getRoomKey(groupId);
                if (roomKeyHex && nip29LeavePublished) {
                    const sealedLeave = await groupService.sendSealedLeave({ groupId, roomKeyHex });
                    sealedLeavePublished = await publishScopedGroupEvent({ relayUrl, event: sealedLeave });
                }
            }
            catch {
                sealedLeavePublished = false;
            }
            recordCommunityLeaveRelayPublishOutcome({
                publicKeyHex,
                groupId,
                relayUrl,
                success: nip29LeavePublished,
                errorMessage: nip29LeavePublished ? undefined : "bulk_leave_publish_failed",
            });
            if (nip29LeavePublished && sealedLeavePublished) {
                leftPublishedCount += 1;
            }
            else {
                leftPublishFailureCount += 1;
            }
        }
        return { joinedCount: joinedEntries.length, leftPublishedCount, leftPublishFailureCount };
    }, [identity.state.privateKeyHex, publicKeyHex, publishScopedGroupEvent]);
    const openProfileArchiveResultDialog = (
        archiveResult: ProfileWorkspaceArchiveWriteResult | null,
        mode: "clear_data" | "delete_account" | "delete_profile_window",
    ): void => {
        setProfileArchiveResult(archiveResult);
        setProfileArchiveDialogMode(mode);
        setIsProfileArchiveDialogOpen(true);
        setIsClearDataDialogOpen(false);
        setIsDeleteAccountDialogOpen(false);
        setIsDeleteProfileWindowDialogOpen(false);
    };
    const handleProfileArchiveDialogClose = (): void => {
        setIsProfileArchiveDialogOpen(false);
        setProfileArchiveResult(null);
        if (typeof window !== "undefined") {
            if (profileArchiveDialogMode === "delete_profile_window") {
                performAccountSessionHardReset({
                    reason: "profile_removed",
                    profileId: getResolvedProfileId(),
                    nextPublicKeySuffix: null,
                });
                return;
            }
            window.location.reload();
        }
    };
    const handleClearData = async (): Promise<void> => {
        try {
            setSecurityActionPhase("working");
            setSecurityActionMessage("Exporting archive and clearing local caches...");
            const profileId = getResolvedProfileId();
            const archiveResult = await archiveAndClearProfileLocalDataKeepingIdentity({
                profileId,
                profileLabel: profile.state.profile.username,
                publicKeyHex,
            });
            setSecurityActionPhase("success");
            setSecurityActionMessage("Local caches cleared. Workspace archive saved.");
            openProfileArchiveResultDialog(archiveResult, "clear_data");
        }
        catch (e) {
            console.error(e);
            setSecurityActionPhase("error");
            setSecurityActionMessage("Failed to clear local data.");
            toast.error("Failed to clear local data.");
        }
    };
    const handleResetLocalHistory = async (): Promise<void> => {
        try {
            setStorageActionPhase("working");
            setStorageActionMessage("Resetting local history and sync snapshots...");
            const report = await resetLocalHistoryKeepingIdentity({
                profileId: getResolvedProfileId(),
                publicKeyHex,
            });
            const warningCount = report.warnings.length;
            const summary = `Local history reset. Removed ${report.removedLocalStorageKeyCount} storage key(s), cleared ${report.clearedIndexedDbStoreCount} IndexedDB store(s).`;
            setStorageActionPhase(warningCount > 0 ? "error" : "success");
            setStorageActionMessage(warningCount > 0 ? `${summary} Completed with ${warningCount} warning(s).` : summary);
            if (warningCount > 0) {
                toast.warning(`Local history reset completed with ${warningCount} warning(s).`);
            }
            else {
                toast.success("Local history reset completed.");
            }
            setIsResetLocalHistoryDialogOpen(false);
            if (typeof window !== "undefined") {
                window.location.reload();
            }
        }
        catch (error) {
            console.error(error);
            setStorageActionPhase("error");
            setStorageActionMessage("Failed to reset local history.");
            toast.error("Failed to reset local history.");
            setIsResetLocalHistoryDialogOpen(false);
        }
    };
    const handleDeleteAccount = async (): Promise<void> => {
        try {
            setSecurityActionPhase("working");
            setSecurityActionMessage("Exporting archive, leaving communities, and removing local data...");
            const profileId = getResolvedProfileId();
            const archiveResult = await archiveProfileWorkspaceBeforeWipe({
                profileId,
                profileLabel: profile.state.profile.username,
                reason: "settings_delete_account",
                lastBoundPublicKeyHex: publicKeyHex ?? null,
            });
            if (publicKeyHex) {
                markRetiredIdentityPublicKey({ publicKeyHex, profileId });
            }
            const publishResult = await publishProfile({
                username: "Deleted Account",
                about: "This account has been deleted.",
                avatarUrl: "",
                nip05: "",
                lud16: "",
                inviteCode: "",
            });
            const leaveResult = await leaveJoinedCommunitiesBeforeAccountDeletion();
            try {
                await identity.forgetIdentity();
            }
            catch (identityError) {
                console.error("Identity forget failed during delete account:", identityError);
            }
            clearLastBoundAccountPublicKeyHex(profileId);
            await wipeProfileWorkspaceCompletely({
                profileId,
                publicKeyHex: publicKeyHex ?? null,
            });
            if (!publishResult) {
                toast.warning("Local data was removed, but profile overwrite could not be confirmed on relays.");
            }
            if (leaveResult.leftPublishFailureCount > 0) {
                toast.warning(`Local data was removed, but ${leaveResult.leftPublishFailureCount} community leave event(s) could not be confirmed on relays.`);
            }
            setSecurityActionPhase("success");
            setSecurityActionMessage("Local profile data removed. Workspace archive saved.");
            openProfileArchiveResultDialog(archiveResult, "delete_account");
        }
        catch (e) {
            console.error(e);
            setSecurityActionPhase("error");
            setSecurityActionMessage("Local data removal did not complete cleanly.");
            toast.error("Failed to remove local profile data.");
        }
        finally {
            setDeleteAccountConfirmInput("");
            setDeleteAccountCountdown(0);
        }
    };
    const handleArmDeleteAccount = (): void => {
        if (deleteAccountConfirmInput.trim() !== DELETE_ACCOUNT_CONFIRM_TEXT) {
            toast.error(`Type "${DELETE_ACCOUNT_CONFIRM_TEXT}" to continue.`);
            return;
        }
        setDeleteAccountCountdown(5);
    };
    const handleOpenDeleteProfileWindowDialog = (): void => {
        setDeleteProfileWindowConfirmInput("");
        setIsDeleteProfileWindowDialogOpen(true);
    };
    const handleCloseDeleteProfileWindowDialog = (): void => {
        if (securityActionPhase === "working") {
            return;
        }
        setIsDeleteProfileWindowDialogOpen(false);
        setDeleteProfileWindowConfirmInput("");
    };
    const handleDeleteProfileWindow = async (): Promise<void> => {
        if (deleteProfileWindowConfirmInput.trim() !== DELETE_PROFILE_WINDOW_CONFIRM_TEXT) {
            toast.error(t("settings.dialogs.deleteProfileWindowTypeConfirm", {
                phrase: DELETE_PROFILE_WINDOW_CONFIRM_TEXT,
            }));
            return;
        }
        try {
            setSecurityActionPhase("working");
            setSecurityActionMessage(isDefaultProfileWindow
                ? t("settings.dialogs.resetProfileWindowWorking")
                : t("settings.dialogs.deleteProfileWindowWorking"));
            const archiveResult = await deleteCurrentProfileWindowCompletely({
                profileId: resolvedProfileId,
                profileLabel: profile.state.profile.username.trim() || desktopSnapshot.currentWindow.profileLabel,
                publicKeyHex,
                syncInMemoryIdentity: async () => {
                    try {
                        await identity.forgetIdentity();
                    } catch (identityError) {
                        console.warn("In-memory identity sync after profile window purge:", identityError);
                    }
                },
            });
            setSecurityActionPhase("success");
            setSecurityActionMessage(isDefaultProfileWindow
                ? t("settings.dialogs.resetProfileWindowSuccess")
                : t("settings.dialogs.deleteProfileWindowSuccess"));
            setIsDeleteProfileWindowDialogOpen(false);
            setDeleteProfileWindowConfirmInput("");
            if (isDefaultProfileWindow || !hasNativeRuntime()) {
                openProfileArchiveResultDialog(archiveResult, "delete_profile_window");
            }
        } catch (error) {
            console.error(error);
            setSecurityActionPhase("error");
            setSecurityActionMessage(t("settings.dialogs.deleteProfileWindowFailed"));
            toast.error(t("settings.dialogs.deleteProfileWindowFailed"));
        }
    };
    const handleRelayBulkDisableAllRequest = (): void => {
        if (relayList.state.relays.length === 0) {
            return;
        }
        setIsDisableAllRelaysDialogOpen(true);
    };
    const handleRelayBulkDisableAllConfirm = (): void => {
        if (relayList.state.relays.length === 0) {
            setIsDisableAllRelaysDialogOpen(false);
            return;
        }
        relayList.replaceRelays({
            relays: relayList.state.relays.map((r) => ({ url: r.url, enabled: false })),
        });
        toast.success(t("settings.relays.bulkDisableAll"));
        setIsDisableAllRelaysDialogOpen(false);
    };
    useEffect(() => {
        if (deleteAccountCountdown <= 0)
            return;
        const timer = setTimeout(() => setDeleteAccountCountdown((prev) => Math.max(0, prev - 1)), 1000);
        return () => clearTimeout(timer);
    }, [deleteAccountCountdown]);
    useEffect(() => {
        if (deleteAccountCountdown > 0 && deleteAccountConfirmInput.trim() !== DELETE_ACCOUNT_CONFIRM_TEXT) {
            setDeleteAccountCountdown(0);
        }
    }, [deleteAccountConfirmInput, deleteAccountCountdown]);
    return {
        DELETE_ACCOUNT_CONFIRM_TEXT,
        DELETE_PROFILE_WINDOW_CONFIRM_TEXT,
        deleteAccountConfirmInput,
        deleteAccountCountdown,
        deleteProfileWindowConfirmInput,
        handleArmDeleteAccount,
        handleCloseDeleteProfileWindowDialog,
        handleDeleteProfileWindow,
        handleOpenDeleteProfileWindowDialog,
        handleClearData,
        handleDeleteAccount,
        handleProfileArchiveDialogClose,
        handleRelayBulkDisableAllConfirm,
        handleRelayBulkDisableAllRequest,
        handleResetLocalHistory,
        isClearDataDialogOpen,
        isDeleteAccountDialogOpen,
        isDeleteProfileWindowDialogOpen,
        isDefaultProfileWindow,
        isDisableAllRelaysDialogOpen,
        isProfileArchiveDialogOpen,
        isResetLocalHistoryDialogOpen,
        profileArchiveDialogMode,
        profileArchiveResult,
        securityActionMessage,
        securityActionPhase,
        setDeleteAccountConfirmInput,
        setDeleteAccountCountdown,
        setDeleteProfileWindowConfirmInput,
        setIsClearDataDialogOpen,
        setIsDeleteAccountDialogOpen,
        setIsDisableAllRelaysDialogOpen,
        setIsResetLocalHistoryDialogOpen,
        setSecurityActionMessage,
        setSecurityActionPhase,
        setStorageActionMessage,
        setStorageActionPhase,
        storageActionMessage,
        storageActionPhase,
    };
}
