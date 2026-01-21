"use client";

import type React from "react";
import { TitleBar } from "./title-bar";
import { useDesktopNotifications } from "../../lib/desktop/use-desktop-notifications";
import { useDesktopTheme } from "../../lib/desktop/use-desktop-theme";
import { useIsDesktop } from "../../lib/desktop/use-tauri";

/**
 * Example component demonstrating desktop feature integration
 * This shows how to use window controls, notifications, and theme in a real component
 */
export function DesktopIntegrationExample(): React.JSX.Element {
  const isDesktop = useIsDesktop();
  const { showNotification, enabled: notificationsEnabled, setEnabled: setNotificationsEnabled } = useDesktopNotifications();
  const { preference, setPreference, systemTheme, effectiveTheme } = useDesktopTheme();

  const handleTestNotification = async () => {
    await showNotification("Test Notification", "This is a test notification from Obscur");
  };

  return (
    <div className="flex min-h-screen flex-col">
      {/* Custom title bar with window controls (only shows in desktop) */}
      <TitleBar title="Obscur - Desktop Features Demo" showControls={true} />

      <div className="flex-1 p-8">
        <h1 className="mb-6 text-2xl font-bold">Desktop Integration Demo</h1>

        {/* Environment Info */}
        <section className="mb-8 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="mb-2 text-lg font-semibold">Environment</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Running in: <span className="font-medium">{isDesktop ? "Desktop App" : "Web Browser"}</span>
          </p>
        </section>

        {/* Notifications */}
        <section className="mb-8 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="mb-4 text-lg font-semibold">Notifications</h2>
          <div className="space-y-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={notificationsEnabled}
                onChange={(e) => setNotificationsEnabled({ enabled: e.target.checked })}
                className="h-4 w-4"
              />
              <span className="text-sm">Enable notifications</span>
            </label>
            <button
              onClick={handleTestNotification}
              disabled={!notificationsEnabled}
              className="rounded bg-blue-500 px-4 py-2 text-sm text-white hover:bg-blue-600 disabled:opacity-50"
            >
              Send Test Notification
            </button>
            <p className="text-xs text-zinc-500">
              {isDesktop
                ? "Uses native desktop notifications"
                : "Uses web notifications API"}
            </p>
          </div>
        </section>

        {/* Theme */}
        <section className="mb-8 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="mb-4 text-lg font-semibold">Theme</h2>
          <div className="space-y-4">
            <div className="flex gap-2">
              <button
                onClick={() => setPreference("system")}
                className={`rounded px-4 py-2 text-sm ${
                  preference === "system"
                    ? "bg-blue-500 text-white"
                    : "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                }`}
              >
                System
              </button>
              <button
                onClick={() => setPreference("light")}
                className={`rounded px-4 py-2 text-sm ${
                  preference === "light"
                    ? "bg-blue-500 text-white"
                    : "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                }`}
              >
                Light
              </button>
              <button
                onClick={() => setPreference("dark")}
                className={`rounded px-4 py-2 text-sm ${
                  preference === "dark"
                    ? "bg-blue-500 text-white"
                    : "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                }`}
              >
                Dark
              </button>
            </div>
            <div className="space-y-1 text-xs text-zinc-500">
              <p>Current preference: <span className="font-medium">{preference}</span></p>
              {isDesktop && systemTheme && (
                <p>System theme: <span className="font-medium">{systemTheme}</span></p>
              )}
              <p>Effective theme: <span className="font-medium">{effectiveTheme}</span></p>
            </div>
          </div>
        </section>

        {/* Desktop-specific features */}
        {isDesktop && (
          <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <h2 className="mb-4 text-lg font-semibold">Desktop-Only Features</h2>
            <ul className="list-inside list-disc space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
              <li>Native window controls (minimize, maximize, close)</li>
              <li>Window state persistence (size, position)</li>
              <li>Native system notifications</li>
              <li>System theme detection and synchronization</li>
              <li>Auto-updater integration</li>
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
