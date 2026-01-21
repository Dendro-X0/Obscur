"use client";

import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

interface UpdateInfo {
  available: boolean;
  version?: string;
  message?: string;
}

export const DesktopUpdater = () => {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    // Check if running in Tauri desktop app
    const checkDesktop = async () => {
      try {
        // @ts-ignore - Tauri global is only available in desktop
        if (window.__TAURI__) {
          setIsDesktop(true);
        }
      } catch {
        setIsDesktop(false);
      }
    };

    checkDesktop();
  }, []);

  const checkForUpdates = async () => {
    if (!isDesktop) return;

    try {
      setError(null);
      const result = await invoke<string>("check_for_updates");
      
      if (result.includes("Update available")) {
        const version = result.replace("Update available: ", "");
        setUpdateInfo({
          available: true,
          version,
          message: `Version ${version} is available`,
        });
      } else {
        setUpdateInfo({
          available: false,
          message: "You're running the latest version",
        });
      }
    } catch (err) {
      setError(err as string);
      console.error("Failed to check for updates:", err);
    }
  };

  const installUpdate = async () => {
    if (!isDesktop || !updateInfo?.available) return;

    try {
      setIsInstalling(true);
      setError(null);
      await invoke("install_update");
      // App will restart automatically after update
    } catch (err) {
      setError(err as string);
      setIsInstalling(false);
      console.error("Failed to install update:", err);
    }
  };

  const dismissUpdate = () => {
    setUpdateInfo(null);
    setError(null);
  };

  // Don't render anything if not in desktop mode
  if (!isDesktop) {
    return null;
  }

  // Show update notification if available
  if (updateInfo?.available) {
    return (
      <div className="fixed bottom-4 right-4 z-50 max-w-md">
        <Card className="p-4 shadow-lg border-2 border-blue-500">
          <div className="flex flex-col gap-3">
            <div>
              <h3 className="font-semibold text-lg">Update Available</h3>
              <p className="text-sm text-muted-foreground">
                {updateInfo.message}
              </p>
            </div>

            {error && (
              <div className="text-sm text-red-500 bg-red-50 dark:bg-red-950 p-2 rounded">
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={installUpdate}
                disabled={isInstalling}
                className="flex-1"
              >
                {isInstalling ? "Installing..." : "Install Update"}
              </Button>
              <Button
                onClick={dismissUpdate}
                variant="outline"
                disabled={isInstalling}
              >
                Later
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Show manual check button in settings or menu
  return (
    <div className="flex items-center gap-2">
      <Button onClick={checkForUpdates} variant="outline" size="sm">
        Check for Updates
      </Button>
      {updateInfo && !updateInfo.available && (
        <span className="text-sm text-muted-foreground">
          {updateInfo.message}
        </span>
      )}
      {error && (
        <span className="text-sm text-red-500">{error}</span>
      )}
    </div>
  );
};
