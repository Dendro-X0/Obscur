"use client";

import { useEffect, useCallback } from "react";
import { useNotificationPreference } from "../../notifications/hooks/use-notification-preference";
import { showDesktopNotification } from "../../notifications/utils/show-desktop-notification";
import { requestNotificationPermission } from "../../notifications/utils/request-notification-permission";
import type { NotificationChannels } from "../../notifications/utils/notification-channels";

const DESKTOP_NOTIFICATION_TAG: string = "obscur-notification";
type NotificationChannelKey = keyof NotificationChannels;

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
    async (title: string, body: string, channel: NotificationChannelKey = "dmMessages") => {
      if (!state.enabled || !state.channels[channel]) {
        return;
      }

      await showDesktopNotification({ title, body, tag: DESKTOP_NOTIFICATION_TAG });
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
