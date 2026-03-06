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
  isDevBuild?: boolean;
}

type DesktopUpdaterProps = Readonly<{
  variant?: "background" | "inline";
}>;

type GitHubRelease = Readonly<{
  tag_name: string;
  html_url?: string;
}>;

const normalizeVersion = (version: string): string => version.trim().replace(/^v/i, "");

const parseSemverParts = (raw: string): number[] | null => {
  const normalized = normalizeVersion(raw).split("-")[0];
  if (!/^\d+(\.\d+){1,3}$/.test(normalized)) {
    return null;
  }
  return normalized.split(".").map((x) => Number.parseInt(x, 10) || 0);
};

const compareVersions = (currentRaw: string, latestRaw: string): number | null => {
  const currentParts = parseSemverParts(currentRaw);
  const latestParts = parseSemverParts(latestRaw);
  if (!currentParts || !latestParts) {
    return null;
  }
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
  const isDevBuild = useMemo(() => parseSemverParts(currentVersion) === null, [currentVersion]);

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
      const versionComparison = compareVersions(currentVersion, latestTag);
      const githubHasUpdate = versionComparison !== null ? versionComparison < 0 : false;

      if (tauriHasUpdate || githubHasUpdate) {
        const targetVersion = tauriVersion || latestTag;
        setUpdateInfo({
          available: true,
          version: targetVersion,
          latestTag,
          currentVersion,
          source: tauriHasUpdate && githubHasUpdate ? "both" : tauriHasUpdate ? "tauri" : "github",
          message: t("settings.updates.versionAvailable", { version: targetVersion }),
          isDevBuild,
        });
        return;
      }

      setUpdateInfo({
        available: false,
        latestTag,
        currentVersion,
        source: isDesktop ? "both" : "github",
        message: isDevBuild
          ? `Development build detected. Latest stable tag: v${latestTag}.`
          : t("settings.updates.latest"),
        isDevBuild,
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={checkForUpdates}
          variant="outline"
          disabled={isChecking}
          className="min-h-9 rounded-xl px-4 py-1 text-xs font-semibold"
        >
          {isChecking ? t("settings.updates.checking") : t("settings.updates.check")}
        </Button>
        {isDesktop && updateInfo?.available ? (
          <Button
            onClick={installUpdate}
            disabled={isInstalling}
            className="min-h-9 rounded-xl px-4 py-1 text-xs font-semibold"
          >
            {isInstalling ? t("settings.updates.installing") : t("settings.updates.install")}
          </Button>
        ) : null}
        {releaseUrl ? (
          <Button
            type="button"
            variant="ghost"
            className="min-h-9 rounded-xl px-4 py-1 text-xs font-semibold text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
            onClick={() => window.open(releaseUrl, "_blank", "noopener,noreferrer")}
          >
            View release notes
          </Button>
        ) : null}
      </div>
      <div className="rounded-xl border border-black/5 bg-zinc-50/60 px-3 py-2 text-xs text-zinc-600 dark:border-white/10 dark:bg-zinc-900/50 dark:text-zinc-400">
        Current: {updateInfo?.currentVersion || currentVersion}
        {updateInfo?.latestTag ? ` | Latest tag: ${updateInfo.latestTag}` : ""}
        {updateInfo?.source ? ` | Source: ${updateInfo.source}` : ""}
      </div>
      {updateInfo ? (
        updateInfo.available ? (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-300">
            New version available: v{updateInfo.version || updateInfo.latestTag}. You are on v{updateInfo.currentVersion || currentVersion}.
          </div>
        ) : (
          <div className={isDevBuild
            ? "rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-xs font-medium text-blue-700 dark:text-blue-300"
            : "rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-300"
          }>
            {isDevBuild
              ? `Development build (v${currentVersion}). Latest stable tag: v${updateInfo.latestTag ?? "unknown"}.`
              : t("settings.updates.latest")}
          </div>
        )
      ) : (
        <div className="rounded-xl border border-black/5 bg-zinc-50/60 px-3 py-2 text-xs text-zinc-500 dark:border-white/10 dark:bg-zinc-900/50">
          Version status not checked yet.
        </div>
      )}
      {error ? <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-300">{error}</div> : null}
    </div>
  );
};
