"use client";

import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, Radio, Server, Sparkles, UserCircle2 } from "lucide-react";
import { useAccountProjectionSnapshot } from "@/app/features/account-sync/hooks/use-account-projection-snapshot";
import { useAccountSyncSnapshot } from "@/app/features/account-sync/hooks/use-account-sync-snapshot";
import { useWindowRuntime } from "@/app/features/runtime/services/window-runtime-supervisor";
import { cn } from "@/app/lib/utils";

type LaunchStepStatus = "pending" | "active" | "done" | "degraded";

type LaunchStep = Readonly<{
  key: string;
  label: string;
  description: string;
  status: LaunchStepStatus;
}>;

const STARTUP_OVERLAY_MIN_VISIBLE_MS = 900;
const STARTUP_OVERLAY_BYPASS_THRESHOLD_MS = 10_000;

const stepContribution = (status: LaunchStepStatus): number => {
  if (status === "done") {
    return 1;
  }
  if (status === "degraded") {
    return 0.85;
  }
  if (status === "active") {
    return 0.45;
  }
  return 0;
};

export function StartupExperienceOverlay(): React.JSX.Element | null {
  const runtime = useWindowRuntime().snapshot;
  const accountSyncSnapshot = useAccountSyncSnapshot();
  const projectionSnapshot = useAccountProjectionSnapshot();
  const [isVisible, setIsVisible] = useState(false);
  const [manuallyDismissed, setManuallyDismissed] = useState(false);
  const [startedAtUnixMs, setStartedAtUnixMs] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const runtimeSettled = runtime.phase === "ready" || runtime.phase === "degraded";
  const relayPhase = runtime.relayRuntime.phase;
  const relayConnected = runtime.relayRuntime.writableRelayCount > 0;
  const relaySettled = relayConnected || relayPhase === "healthy" || relayPhase === "degraded" || relayPhase === "recovering" || relayPhase === "offline" || relayPhase === "fatal";
  const accountSyncReady = accountSyncSnapshot.phase === "ready" || accountSyncSnapshot.phase === "error";
  const projectionReady = projectionSnapshot.phase === "ready" || projectionSnapshot.phase === "degraded";
  const startupComplete = runtimeSettled && accountSyncReady && projectionReady && relaySettled;
  const startupTransitioning = runtime.phase === "booting" || runtime.phase === "binding_profile" || runtime.phase === "unlocking" || runtime.phase === "activating_runtime";
  const shouldParticipate = runtime.phase !== "auth_required" && runtime.phase !== "fatal" && runtime.session.identityStatus !== "locked";
  const shouldShow = shouldParticipate && !startupComplete && !manuallyDismissed && startupTransitioning;

  useEffect(() => {
    if (!shouldParticipate) {
      setIsVisible(false);
      setManuallyDismissed(false);
      setStartedAtUnixMs(null);
      return;
    }

    if (shouldShow) {
      if (!isVisible) {
        setIsVisible(true);
        setStartedAtUnixMs(Date.now());
      }
      return;
    }

    if (!isVisible) {
      return;
    }

    const visibleForMs = Date.now() - (startedAtUnixMs ?? Date.now());
    const remainingMs = Math.max(0, STARTUP_OVERLAY_MIN_VISIBLE_MS - visibleForMs);
    const timeoutId = window.setTimeout(() => {
      setIsVisible(false);
    }, remainingMs);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isVisible, shouldParticipate, shouldShow, startedAtUnixMs]);

  useEffect(() => {
    if (!isVisible) {
      return;
    }
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 250);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [isVisible]);

  const steps = useMemo<ReadonlyArray<LaunchStep>>(() => {
    const identityStep: LaunchStepStatus = runtime.session.identityStatus === "unlocked"
      ? "done"
      : runtime.session.identityStatus === "error"
        ? "degraded"
        : runtime.session.identityStatus === "loading"
          ? "active"
          : "pending";

    const syncStep: LaunchStepStatus = accountSyncSnapshot.phase === "ready"
      ? "done"
      : accountSyncSnapshot.phase === "error"
        ? "degraded"
        : accountSyncSnapshot.phase === "restoring_account_data" || accountSyncSnapshot.phase === "syncing_messages_and_requests" || accountSyncSnapshot.phase === "restoring_profile"
          ? "active"
          : "pending";

    const projectionStep: LaunchStepStatus = projectionSnapshot.phase === "ready" && projectionSnapshot.accountProjectionReady
      ? "done"
      : projectionSnapshot.phase === "degraded"
        ? "degraded"
        : projectionSnapshot.phase === "bootstrapping" || projectionSnapshot.phase === "replaying_event_log"
          ? "active"
          : "pending";

    const relayStep: LaunchStepStatus = relayConnected
      ? "done"
      : relayPhase === "degraded" || relayPhase === "offline" || relayPhase === "fatal"
        ? "degraded"
        : relayPhase === "connecting" || relayPhase === "recovering" || relayPhase === "booting"
          ? "active"
          : "pending";

    return [
      {
        key: "identity",
        label: "Identity & Profile",
        description: runtime.session.profileLabel || runtime.session.profileId,
        status: identityStep,
      },
      {
        key: "sync",
        label: "Account Data Sync",
        description: accountSyncSnapshot.message || "Restoring account state",
        status: syncStep,
      },
      {
        key: "projection",
        label: "Content & Rendering",
        description: projectionSnapshot.phase === "ready" ? "Projection ready" : "Building conversation projection",
        status: projectionStep,
      },
      {
        key: "relay",
        label: "Relay Connection",
        description: relayConnected
          ? `${runtime.relayRuntime.writableRelayCount} writable relay${runtime.relayRuntime.writableRelayCount === 1 ? "" : "s"}`
          : "Connecting to relay network",
        status: relayStep,
      },
    ];
  }, [
    accountSyncSnapshot.message,
    accountSyncSnapshot.phase,
    projectionSnapshot.accountProjectionReady,
    projectionSnapshot.phase,
    relayConnected,
    relayPhase,
    runtime.relayRuntime.writableRelayCount,
    runtime.session.identityStatus,
    runtime.session.profileId,
    runtime.session.profileLabel,
  ]);

  const progressPercent = useMemo(() => {
    const total = steps.reduce((sum, step) => sum + stepContribution(step.status), 0);
    return Math.min(100, Math.max(8, Math.round((total / steps.length) * 100)));
  }, [steps]);

  const elapsedMs = startedAtUnixMs ? Math.max(0, nowMs - startedAtUnixMs) : 0;
  const canBypass = elapsedMs >= STARTUP_OVERLAY_BYPASS_THRESHOLD_MS;

  if (!isVisible) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[2200] flex items-center justify-center bg-gradient-to-b from-zinc-950/90 via-zinc-900/85 to-zinc-950/90 px-4 py-6 text-zinc-50 backdrop-blur-md">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -left-16 top-12 h-48 w-48 rounded-full bg-cyan-500/20 blur-3xl animate-pulse" />
        <div className="absolute right-0 top-24 h-56 w-56 rounded-full bg-indigo-500/20 blur-3xl animate-pulse" />
        <div className="absolute bottom-0 left-1/3 h-44 w-44 rounded-full bg-fuchsia-500/20 blur-3xl animate-pulse" />
      </div>

      <div className="pointer-events-auto relative w-full max-w-xl rounded-3xl border border-white/15 bg-zinc-950/70 p-6 shadow-2xl shadow-black/60">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/5">
              <Sparkles className="h-5 w-5 text-cyan-300" />
              <div className="absolute -inset-1 rounded-2xl border border-cyan-400/35 animate-pulse" />
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-zinc-400">Obscur Startup</p>
              <h2 className="text-xl font-semibold">Preparing your workspace</h2>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-1 text-xs font-bold text-zinc-300">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-300" />
            {progressPercent}%
          </div>
        </div>

        <div className="mb-5 h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-indigo-400 to-fuchsia-400 transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="space-y-2.5">
          {steps.map((step) => (
            <div key={step.key} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
              <div className="mt-0.5">
                {step.key === "identity" ? (
                  <StepIcon icon={<UserCircle2 className="h-4 w-4" />} status={step.status} />
                ) : step.key === "sync" ? (
                  <StepIcon icon={<Sparkles className="h-4 w-4" />} status={step.status} />
                ) : step.key === "projection" ? (
                  <StepIcon icon={<CheckCircle2 className="h-4 w-4" />} status={step.status} />
                ) : (
                  <StepIcon icon={<Server className="h-4 w-4" />} status={step.status} />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-100">{step.label}</p>
                <p className="mt-0.5 text-xs text-zinc-400 line-clamp-2">{step.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between">
          <p className="inline-flex items-center gap-2 text-xs text-zinc-400">
            <Radio className="h-3.5 w-3.5 text-cyan-300" />
            Startup operations continue in the background if relays are unstable.
          </p>
          {canBypass ? (
            <button
              type="button"
              onClick={() => setManuallyDismissed(true)}
              className="rounded-lg border border-white/20 bg-white/5 px-2.5 py-1 text-xs font-semibold text-zinc-300 transition hover:bg-white/10 hover:text-white"
            >
              Continue
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function StepIcon(props: Readonly<{ icon: React.JSX.Element; status: LaunchStepStatus }>): React.JSX.Element {
  if (props.status === "done") {
    return (
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
        <CheckCircle2 className="h-4 w-4" />
      </div>
    );
  }
  if (props.status === "active") {
    return (
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-300">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }
  if (props.status === "degraded") {
    return (
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/20 text-amber-300">
        {React.cloneElement(props.icon, {
          className: cn(props.icon.props.className ?? "", "opacity-90"),
        })}
      </div>
    );
  }
  return (
    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-zinc-400">
      {props.icon}
    </div>
  );
}
