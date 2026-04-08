"use client";

import { useEffect, useCallback } from "react";
import { useNotificationPreference } from "../../notifications/hooks/use-notification-preference";
import { showDesktopNotification } from "../../notifications/utils/show-desktop-notification";
import { requestNotificationPermission } from "../../notifications/utils/request-notification-permission";
import type { NotificationChannels } from "../../notifications/utils/notification-channels";

const DESKTOP_NOTIFICATION_TAG: string = "obscur-notification";
type NotificationChannelKey = keyof NotificationChannels;
type ShowDesktopNotificationOptions = Readonly<{
  onClick?: () => void;
  data?: Record<string, unknown>;
  requireInteraction?: boolean;
  actions?: ReadonlyArray<Readonly<{ action: string; title: string }>>;
  force?: boolean;
}>;

/**
 * Hook to integrate desktop notifications with PWA notification system
 * Automatically uses Tauri notifications when in desktop environment
 */
export function useDesktopNotifications() {
  const { state, setEnabled, setChannels } = useNotificationPreference();

  // Request permission when enabled
  useEffect(() => {
    if (!state.enabled) return;

    const requestPermission = async () => {
      const { permission } = await requestNotificationPermission();
      if (permission !== "granted") {
        console.warn("Desktop notification permission denied");
      }
    };

    void requestPermission();
  }, [state.enabled]);

  // Show notification function that uses desktop or web notifications
  const showNotification = useCallback(
    async (
      title: string,
      body: string,
      channel: NotificationChannelKey = "dmMessages",
      options?: ShowDesktopNotificationOptions,
    ) => {
      if (!options?.force && (!state.enabled || !state.channels[channel])) {
        return;
      }

      await showDesktopNotification({
        title,
        body,
        tag: DESKTOP_NOTIFICATION_TAG,
        onClick: options?.onClick,
        data: options?.data,
        requireInteraction: options?.requireInteraction,
        actions: options?.actions,
      });
    },
    [state.enabled, state.channels]
  );

  return {
    showNotification,
    enabled: state.enabled,
    channels: state.channels,
    setEnabled,
    setChannels,
    permission: state.permission,
  };
}
