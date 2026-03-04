"use client";

import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { useTranslation } from "react-i18next";

const GITHUB_LATEST_RELEASE_URL = "https://api.github.com/repos/Dendro-X0/Obscur/releases/latest";
const AUTO_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const APP_VERSION = (process.env.NEXT_PUBLIC_APP_VERSION ?? "dev").replace(/^v/i, "");

interface UpdateInfo {
  available: boolean;
  version?: string;
  latestTag?: string;
  currentVersion?: string;
  source?: "tauri" | "github" | "both";
  message?: string;
}

type DesktopUpdaterProps = Readonly<{
  variant?: "background" | "inline";
}>;

type GitHubRelease = Readonly<{
  tag_name: string;
  html_url?: string;
}>;

const normalizeVersion = (version: string): string => version.trim().replace(/^v/i, "");

const compareVersions = (currentRaw: string, latestRaw: string): number => {
  const current = normalizeVersion(currentRaw).split("-")[0];
  const latest = normalizeVersion(latestRaw).split("-")[0];
  const currentParts = current.split(".").map((x) => Number.parseInt(x, 10) || 0);
  const latestParts = latest.split(".").map((x) => Number.parseInt(x, 10) || 0);
  const max = Math.max(currentParts.length, latestParts.length);
  for (let i = 0; i < max; i += 1) {
    const a = currentParts[i] ?? 0;
    const b = latestParts[i] ?? 0;
    if (a !== b) return a < b ? -1 : 1;
  }
  return 0;
};

export const DesktopUpdater = ({ variant = "background" }: DesktopUpdaterProps) => {
  const { t } = useTranslation();
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [releaseUrl, setReleaseUrl] = useState<string | null>(null);
  const currentVersion = useMemo(() => normalizeVersion(APP_VERSION), []);

  useEffect(() => {
    // Check if running in Tauri desktop app
    const checkDesktop = async () => {
      try {
        const tauriWindow = window as Window & { __TAURI__?: unknown };
        if (tauriWindow.__TAURI__) {
          setIsDesktop(true);
        }
      } catch {
        setIsDesktop(false);
      }
    };

    checkDesktop();
  }, []);

  const checkForUpdates = async () => {
    try {
      setIsChecking(true);
      setError(null);
      const tauriCheckPromise = isDesktop
        ? invoke<string>("check_for_updates").catch(() => "No updates available")
        : Promise.resolve("No updates available");
      const [tauriResult, releaseResponse] = await Promise.all([
        tauriCheckPromise,
        fetch(GITHUB_LATEST_RELEASE_URL, { headers: { Accept: "application/vnd.github+json" } }),
      ]);

      let latestTag = currentVersion;
      let htmlUrl: string | null = null;
      if (releaseResponse.ok) {
        const release = (await releaseResponse.json()) as GitHubRelease;
        latestTag = normalizeVersion(release.tag_name || currentVersion);
        htmlUrl = release.html_url || null;
      }
      setReleaseUrl(htmlUrl);

      const tauriHasUpdate = typeof tauriResult === "string" && tauriResult.includes("Update available");
      const tauriVersion = tauriHasUpdate ? normalizeVersion(tauriResult.replace("Update available: ", "")) : undefined;
      const githubHasUpdate = compareVersions(currentVersion, latestTag) < 0;

      if (tauriHasUpdate || githubHasUpdate) {
        const targetVersion = tauriVersion || latestTag;
        setUpdateInfo({
          available: true,
          version: targetVersion,
          latestTag,
          currentVersion,
          source: tauriHasUpdate && githubHasUpdate ? "both" : tauriHasUpdate ? "tauri" : "github",
          message: t("settings.updates.versionAvailable", { version: targetVersion }),
        });
        return;
      }

      setUpdateInfo({
        available: false,
        latestTag,
        currentVersion,
        source: isDesktop ? "both" : "github",
        message: t("settings.updates.latest"),
      });
    } catch (err) {
      setError(err as string);
      console.error("Failed to check for updates:", err);
    } finally {
      setIsChecking(false);
    }
  };

  const installUpdate = async () => {
    if (!isDesktop || !updateInfo?.available) return;

    try {
      const ok = window.confirm(`Install update ${updateInfo.version ?? ""} now? The app may restart after install.`);
      if (!ok) return;
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

  useEffect(() => {
    if (!isDesktop || variant !== "background") return;
    void checkForUpdates();
    const timer = setInterval(() => {
      void checkForUpdates();
    }, AUTO_CHECK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [isDesktop, variant]);

  useEffect(() => {
    if (variant !== "inline") return;
    void checkForUpdates();
  }, [variant, isDesktop]);

  // Show update notification if available
  if (isDesktop && variant === "background" && updateInfo?.available) {
    return (
      <div className="fixed bottom-4 right-4 z-50 max-w-md">
        <Card className="p-4 shadow-lg border-2 border-purple-500">
          <div className="flex flex-col gap-3">
            <div>
              <h3 className="font-semibold text-lg">{t("settings.updates.available")}</h3>
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
                {isInstalling ? t("settings.updates.installing") : t("settings.updates.install")}
              </Button>
              <Button
                onClick={dismissUpdate}
                variant="outline"
                disabled={isInstalling}
              >
                {t("settings.updates.later")}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (!isDesktop && variant === "background") {
    return null;
  }
  if (variant === "background") {
    return null;
  }

  // Inline settings UI
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={checkForUpdates}
          variant="outline"
          disabled={isChecking}
          className="min-h-8 rounded-lg px-3 py-1 text-xs"
        >
          {isChecking ? t("settings.updates.checking") : t("settings.updates.check")}
        </Button>
        {isDesktop && updateInfo?.available ? (
          <Button
            onClick={installUpdate}
            disabled={isInstalling}
            className="min-h-8 rounded-lg px-3 py-1 text-xs"
          >
            {isInstalling ? t("settings.updates.installing") : t("settings.updates.install")}
          </Button>
        ) : null}
        {releaseUrl ? (
          <a
            href={releaseUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-zinc-500 underline hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            View release notes
          </a>
        ) : null}
      </div>
      <div className="text-xs text-zinc-600 dark:text-zinc-400">
        Current: {updateInfo?.currentVersion || currentVersion}
        {updateInfo?.latestTag ? ` | Latest tag: ${updateInfo.latestTag}` : ""}
        {updateInfo?.source ? ` | Source: ${updateInfo.source}` : ""}
      </div>
      {updateInfo ? (
        updateInfo.available ? (
          <div className="text-xs text-amber-600 dark:text-amber-400 font-medium">
            New version available: v{updateInfo.version || updateInfo.latestTag}. You are on v{updateInfo.currentVersion || currentVersion}.
          </div>
        ) : (
          <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            {t("settings.updates.latest")}
          </div>
        )
      ) : (
        <div className="text-xs text-zinc-500">
          Version status not checked yet.
        </div>
      )}
      {error ? <div className="text-xs text-red-500">{error}</div> : null}
    </div>
  );
};
