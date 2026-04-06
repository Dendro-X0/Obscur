"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { useTranslation } from "react-i18next";
import { getRuntimeCapabilities } from "@/app/features/runtime/runtime-capabilities";
import { invokeNativeCommand } from "@/app/features/runtime/native-adapters";
import {
  classifyStreamingUpdateInstallFailure,
  compareVersions,
  evaluateStreamingUpdateDecision,
  parseStreamingUpdateManifest,
  type StreamingUpdateBlockReason,
  type StreamingUpdateChannel,
} from "@/app/features/updates/services/streaming-update-policy";

const GITHUB_LATEST_RELEASE_URL = "https://api.github.com/repos/Dendro-X0/Obscur/releases/latest";
const STREAMING_UPDATE_POLICY_URL = process.env.NEXT_PUBLIC_DESKTOP_UPDATE_POLICY_URL
  ?? "https://github.com/Dendro-X0/Obscur/releases/latest/download/streaming-update-policy.json";
const STREAMING_UPDATE_CHANNEL: StreamingUpdateChannel = "stable";
const ROLLOUT_SEED_STORAGE_KEY = "obscur.desktop.streaming-update.rollout-seed.v1";
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
  eligible?: boolean;
  blockReasonCode?: StreamingUpdateBlockReason | "policy_unavailable";
  forceUpdateRequired?: boolean;
  policySource?: "manifest" | "fallback";
  rollbackBehavior?: "preserve_current_version";
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

const resolveRolloutSeed = (): string => {
  if (typeof window === "undefined") {
    return "server-render-rollout-seed";
  }
  const existing = window.localStorage.getItem(ROLLOUT_SEED_STORAGE_KEY);
  if (existing && existing.trim().length > 0) {
    return existing;
  }
  const nextSeed = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem(ROLLOUT_SEED_STORAGE_KEY, nextSeed);
  return nextSeed;
};

const describePolicyBlockReason = (reason: UpdateInfo["blockReasonCode"]): string => {
  switch (reason) {
    case "kill_switch_active":
      return "Updates are temporarily disabled by the release control kill switch.";
    case "channel_mismatch":
      return "This device is not in the active release channel for the candidate update.";
    case "rollout_holdback":
      return "This update is being rolled out in stages and is not available for this device yet.";
    case "manifest_invalid":
      return "Update policy manifest is invalid; update was blocked for safety.";
    case "policy_unavailable":
      return "Update policy was unavailable; using signed updater checks only.";
    default:
      return "Update policy is currently unavailable.";
  }
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
    setIsDesktop(getRuntimeCapabilities().isDesktop);
  }, []);

  const checkForUpdates = async () => {
    try {
      setIsChecking(true);
      setError(null);
      const tauriCheckPromise = isDesktop
        ? invokeNativeCommand<string>("check_for_updates").then((result) => (result.ok ? result.value : "No updates available"))
        : Promise.resolve("No updates available");
      const [tauriResult, releaseResponse, policyResponse] = await Promise.all([
        tauriCheckPromise,
        fetch(GITHUB_LATEST_RELEASE_URL, { headers: { Accept: "application/vnd.github+json" } }),
        fetch(STREAMING_UPDATE_POLICY_URL, { headers: { Accept: "application/json" } }).catch(() => null),
      ]);

      let latestTag = currentVersion;
      let htmlUrl: string | null = null;
      if (releaseResponse.ok) {
        const release = (await releaseResponse.json()) as GitHubRelease;
        latestTag = normalizeVersion(release.tag_name || currentVersion);
        htmlUrl = release.html_url || null;
      }
      setReleaseUrl(htmlUrl);

      const parsedPolicy = (() => {
        if (!policyResponse || !policyResponse.ok) {
          return null;
        }
        return policyResponse
          .json()
          .then((value) => parseStreamingUpdateManifest(value))
          .catch(() => ({ ok: false as const, reason: "invalid_json" }));
      })();
      const policyManifestResult = parsedPolicy ? await parsedPolicy : null;

      const tauriHasUpdate = typeof tauriResult === "string" && tauriResult.includes("Update available");
      const tauriVersion = tauriHasUpdate ? normalizeVersion(tauriResult.replace("Update available: ", "")) : undefined;
      const versionComparison = compareVersions(currentVersion, latestTag);
      const githubHasUpdate = versionComparison !== null ? versionComparison < 0 : false;

      if (tauriHasUpdate || githubHasUpdate) {
        const targetVersion = tauriVersion || latestTag;
        let eligible = true;
        let blockReasonCode: UpdateInfo["blockReasonCode"];
        let forceUpdateRequired = false;
        let policySource: UpdateInfo["policySource"] = "fallback";
        let rollbackBehavior: UpdateInfo["rollbackBehavior"] = "preserve_current_version";

        if (policyManifestResult?.ok) {
          policySource = "manifest";
          const decision = evaluateStreamingUpdateDecision({
            manifest: policyManifestResult.manifest,
            currentVersion,
            channel: STREAMING_UPDATE_CHANNEL,
            rolloutSeed: resolveRolloutSeed(),
          });
          eligible = decision.eligible;
          blockReasonCode = decision.reasonCode;
          forceUpdateRequired = decision.forceUpdateRequired;
          rollbackBehavior = decision.rollbackBehavior;
          if (!htmlUrl && policyManifestResult.manifest.releaseNotesUrl) {
            htmlUrl = policyManifestResult.manifest.releaseNotesUrl;
            setReleaseUrl(htmlUrl);
          }
        } else if (policyManifestResult && !policyManifestResult.ok) {
          eligible = false;
          blockReasonCode = "manifest_invalid";
        } else {
          blockReasonCode = "policy_unavailable";
        }

        const blockedMessage = !eligible ? describePolicyBlockReason(blockReasonCode) : null;
        setUpdateInfo({
          available: true,
          version: targetVersion,
          latestTag,
          currentVersion,
          source: tauriHasUpdate && githubHasUpdate ? "both" : tauriHasUpdate ? "tauri" : "github",
          message: blockedMessage ?? t("settings.updates.versionAvailable", { version: targetVersion }),
          isDevBuild,
          eligible,
          blockReasonCode,
          forceUpdateRequired,
          policySource,
          rollbackBehavior,
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
        eligible: false,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      console.error("Failed to check for updates:", err);
    } finally {
      setIsChecking(false);
    }
  };

  const installUpdate = async () => {
    if (!isDesktop || !updateInfo?.available || updateInfo.eligible === false) return;

    try {
      const ok = window.confirm(`Install update ${updateInfo.version ?? ""} now? The app may restart after install.`);
      if (!ok) return;
      setIsInstalling(true);
      setError(null);
      const result = await invokeNativeCommand("install_update");
      if (!result.ok) {
        throw new Error(result.message || "Failed to install update");
      }
      // App will restart automatically after update
    } catch (err) {
      const failure = classifyStreamingUpdateInstallFailure(err instanceof Error ? err.message : String(err));
      setError(failure.userMessage);
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
              {updateInfo.forceUpdateRequired ? (
                <p className="text-xs text-amber-600 dark:text-amber-300 mt-1">
                  This device is below the minimum safe version and should update before continuing sensitive operations.
                </p>
              ) : null}
            </div>

            {error && (
              <div className="text-sm text-red-500 bg-red-50 dark:bg-red-950 p-2 rounded">
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={installUpdate}
                disabled={isInstalling || updateInfo.eligible === false}
                className="flex-1"
              >
                {updateInfo.eligible === false
                  ? "Update Blocked"
                  : isInstalling
                    ? t("settings.updates.installing")
                    : t("settings.updates.install")}
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
            disabled={isInstalling || updateInfo.eligible === false}
            className="min-h-9 rounded-xl px-4 py-1 text-xs font-semibold"
          >
            {updateInfo.eligible === false
              ? "Update Blocked"
              : isInstalling
                ? t("settings.updates.installing")
                : t("settings.updates.install")}
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
        {updateInfo?.policySource ? ` | Policy: ${updateInfo.policySource}` : ""}
      </div>
      {updateInfo ? (
        updateInfo.available ? (
          updateInfo.eligible === false ? (
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-700 dark:text-rose-300">
              Update blocked by policy: {describePolicyBlockReason(updateInfo.blockReasonCode)}
            </div>
          ) : (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-300">
              New version available: v{updateInfo.version || updateInfo.latestTag}. You are on v{updateInfo.currentVersion || currentVersion}.
            </div>
          )
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
