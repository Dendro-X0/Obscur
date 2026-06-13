"use client";

import React from "react";
import { useTranslation } from "react-i18next";
import { KeyRound, RefreshCcw, ShieldOff, Loader2 } from "lucide-react";
import { Button, toast } from "@dweb/ui-kit";
import { cn } from "@/app/lib/cn";
import { useMobileCompactLayout } from "@/app/features/runtime/use-mobile-compact-layout";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { revokeDeviceTrust } from "@/app/features/auth/services/device-trust-service";
import {
  resolveDeviceSessionDiagnostic,
  type DeviceSessionDiagnosticSnapshot,
  type DeviceSessionOverallStatus,
} from "@/app/features/auth/services/device-session-diagnostic-service";
import { clearNativeSessionPersistError } from "@/app/features/auth/services/native-session-persist-feedback";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";

const STATUS_BADGE_CLASS: Readonly<Record<DeviceSessionOverallStatus, string>> = {
  unavailable: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20",
  off: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
  active: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  ready: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20",
  keychain_missing: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20",
  mismatch: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20",
  persist_error: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20",
};

export function DeviceSessionSettingsPanel(): React.JSX.Element | null {
  const { t } = useTranslation();
  const compact = useMobileCompactLayout();
  const identity = useIdentity();
  const profileId = getResolvedProfileId();
  const [diagnostic, setDiagnostic] = React.useState<DeviceSessionDiagnosticSnapshot | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isForgetting, setIsForgetting] = React.useState(false);

  const refreshDiagnostic = React.useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const next = await resolveDeviceSessionDiagnostic({
        profileId,
        storedPublicKeyHex: identity.state.stored?.publicKeyHex ?? null,
      });
      setDiagnostic(next);
    } finally {
      setIsLoading(false);
    }
  }, [identity.state.stored?.publicKeyHex, profileId]);

  React.useEffect(() => {
    if (!hasNativeRuntime()) {
      return;
    }
    void refreshDiagnostic();
  }, [refreshDiagnostic]);

  const handleForgetDeviceSession = async (): Promise<void> => {
    if (isForgetting) {
      return;
    }
    setIsForgetting(true);
    try {
      revokeDeviceTrust(profileId);
      clearNativeSessionPersistError(profileId);
      if (identity.resetNativeSecureStorage) {
        await identity.resetNativeSecureStorage();
      }
      toast.success(
        t(
          "settings.deviceSession.forgetSuccess",
          "Device session cleared. You will sign in manually after restart.",
        ),
      );
      await refreshDiagnostic();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings.deviceSession.forgetFailed", "Could not clear device session."),
      );
    } finally {
      setIsForgetting(false);
    }
  };

  if (!hasNativeRuntime()) {
    return null;
  }

  const status = diagnostic?.status ?? "unavailable";
  const statusLabel = t(`settings.deviceSession.status.${status}`, status.replace(/_/g, " "));

  return (
    <div
      id="device-session-settings"
      className={cn(
        "space-y-4 rounded-2xl border border-black/5 bg-white dark:border-white/5 dark:bg-black/20",
        compact ? "p-4" : "p-5",
      )}
      data-testid="device-session-settings-panel"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-zinc-500">
            <KeyRound className="h-4 w-4 text-emerald-500" />
            {t("settings.deviceSession.title", "Device session")}
          </div>
          <p className="text-xs leading-relaxed text-zinc-500">
            {t(
              "settings.deviceSession.desc",
              "OS secure storage used to restore your session after app restart when stay signed in is enabled.",
            )}
          </p>
        </div>
        <span
          className={cn(
            "rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em]",
            STATUS_BADGE_CLASS[status],
          )}
        >
          {statusLabel}
        </span>
      </div>

      <div className={cn("grid gap-2 text-xs", compact ? "grid-cols-1" : "md:grid-cols-2")}>
        <DiagnosticRow
          label={t("settings.deviceSession.staySignedIn", "Stay signed in")}
          value={
            diagnostic?.staySignedInEnabled
              ? t("common.enabled", "Enabled")
              : t("common.disabled", "Disabled")
          }
        />
        <DiagnosticRow
          label={t("settings.deviceSession.keychain", "OS secure storage")}
          value={
            diagnostic?.keychainPublicKeyHex
              ? t("settings.deviceSession.keychainPresent", "Present")
              : t("settings.deviceSession.keychainAbsent", "Not saved")
          }
        />
        <DiagnosticRow
          label={t("settings.deviceSession.inMemory", "In-memory session")}
          value={
            diagnostic?.inMemorySessionActive
              ? t("settings.deviceSession.inMemoryActive", "Active")
              : t("settings.deviceSession.inMemoryLocked", "Locked")
          }
        />
        <DiagnosticRow
          label={t("settings.deviceSession.identityMatch", "Identity match")}
          value={
            diagnostic?.identityMatch === "ok"
              ? t("settings.deviceSession.identityMatchOk", "Matches this profile")
              : diagnostic?.identityMatch === "mismatch"
                ? t("settings.deviceSession.identityMatchMismatch", "Different account")
                : t("settings.deviceSession.identityMatchUnknown", "Unknown")
          }
        />
      </div>

      {diagnostic?.lastPersistError ? (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-xs text-rose-700 dark:text-rose-300">
          <p className="font-bold uppercase tracking-wide text-[10px] text-rose-600 dark:text-rose-400">
            {t("settings.deviceSession.lastPersistError", "Last save error")}
          </p>
          <p className="mt-1 font-mono text-[11px] leading-relaxed">{diagnostic.lastPersistError}</p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void refreshDiagnostic()}
          disabled={isLoading}
          className="h-9"
        >
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCcw className="mr-2 h-4 w-4" />
          )}
          {t("settings.deviceSession.refresh", "Refresh status")}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => void handleForgetDeviceSession()}
          disabled={isForgetting}
          className="h-9 text-rose-700 dark:text-rose-300"
        >
          {isForgetting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ShieldOff className="mr-2 h-4 w-4" />
          )}
          {t("settings.deviceSession.forget", "Forget this device")}
        </Button>
      </div>
    </div>
  );
}

function DiagnosticRow(props: Readonly<{ label: string; value: string }>): React.JSX.Element {
  return (
    <div className="flex items-center justify-between rounded-lg border border-black/5 px-3 py-2 dark:border-white/10">
      <span className="font-semibold text-zinc-500">{props.label}</span>
      <span className="font-bold text-zinc-800 dark:text-zinc-100">{props.value}</span>
    </div>
  );
}
