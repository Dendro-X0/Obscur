"use client";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@dweb/ui-kit";
import { useNotificationPreference } from "@/app/features/notifications/hooks/use-notification-preference";
import { requestNotificationPermission } from "@/app/features/notifications/utils/request-notification-permission";
import { showDesktopNotification } from "@/app/features/notifications/utils/show-desktop-notification";
import type { SettingsActionPhase } from "@/app/features/settings/components/settings-action-status";
import type { SettingsTabPanelModel } from "../settings-tab-panel-model-context";
export function useNotificationsSettingsModel(): SettingsTabPanelModel {
    const { t } = useTranslation();
    const notificationPreference = useNotificationPreference();
    const [notificationActionPhase, setNotificationActionPhase] = useState<SettingsActionPhase>("idle");
    const [notificationActionMessage, setNotificationActionMessage] = useState<string>("");
    const translatePermissionState = useCallback((permission: NotificationPermission | "unsupported"): string => {
        if (permission === "granted")
            return t("settings.notifications.permissionState.granted");
        if (permission === "denied")
            return t("settings.notifications.permissionState.denied");
        if (permission === "default")
            return t("settings.notifications.permissionState.default");
        return t("settings.notifications.permissionState.unsupported");
    }, [t]);
    const handleEnableNotifications = async (): Promise<void> => {
        setNotificationActionPhase("working");
        setNotificationActionMessage("Requesting notification permission...");
        const result = await requestNotificationPermission();
        if (result.permission === "granted") {
            notificationPreference.setEnabled({ enabled: true });
            setNotificationActionPhase("success");
            setNotificationActionMessage("Notifications are enabled.");
            toast.success("Notifications enabled!");
            return;
        }
        if (result.permission === "unsupported") {
            setNotificationActionPhase("error");
            setNotificationActionMessage("Notifications are not supported in this environment.");
            toast.error("Notifications are not supported.");
            return;
        }
        notificationPreference.setEnabled({ enabled: false });
        setNotificationActionPhase("error");
        setNotificationActionMessage("Permission denied. You can enable notifications from system/browser settings.");
        toast.error("Permission denied");
    };
    const handleDisableNotifications = (): void => {
        notificationPreference.setEnabled({ enabled: false });
        setNotificationActionPhase("success");
        setNotificationActionMessage("Notifications are disabled.");
        toast.success("Notifications disabled.");
    };
    const handleToggleNotificationChannel = (channel: "dmMessages" | "mentionsReplies" | "invitesSystem", checked: boolean): void => {
        notificationPreference.setChannels({ channels: { [channel]: checked } });
        setNotificationActionPhase("success");
        setNotificationActionMessage("Notification preferences updated.");
    };
    const handleSendTestNotification = async (): Promise<void> => {
        const permission = notificationPreference.state.permission;
        if (permission === "unsupported") {
            setNotificationActionPhase("error");
            setNotificationActionMessage("Notifications are not supported in this environment.");
            toast.error("Notifications are not supported.");
            return;
        }
        if (permission !== "granted") {
            setNotificationActionPhase("error");
            setNotificationActionMessage(permission === "denied"
                ? "Notifications are blocked. Enable notification permission in system/browser settings."
                : "Notification permission has not been granted yet. Click Enable Notifications first.");
            toast.error(permission === "denied" ? "Notifications are blocked." : "Enable notifications first.");
            return;
        }
        if (!notificationPreference.state.channels.invitesSystem) {
            setNotificationActionPhase("error");
            setNotificationActionMessage("Enable 'Invites and system alerts' to test notification delivery.");
            toast.error("Enable Invites and system alerts first.");
            return;
        }
        const result = await showDesktopNotification({
            title: "Obscur test notification",
            body: "Notification delivery is working correctly.",
            tag: "obscur-settings-test",
        });
        if (!result.ok) {
            setNotificationActionPhase("error");
            setNotificationActionMessage("Notification delivery failed in the current runtime.");
            toast.error("Notification delivery failed.");
            return;
        }
        setNotificationActionPhase("success");
        setNotificationActionMessage("Test notification sent.");
        toast.success("Test notification sent.");
    };
    return {
        handleDisableNotifications,
        handleEnableNotifications,
        handleSendTestNotification,
        handleToggleNotificationChannel,
        notificationActionMessage,
        notificationActionPhase,
        notificationPreference,
        setNotificationActionMessage,
        setNotificationActionPhase,
        t,
        translatePermissionState,
    };
}
