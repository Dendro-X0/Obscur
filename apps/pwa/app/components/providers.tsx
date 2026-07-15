"use client";

import React, { useEffect } from "react";
import { AuthGateway } from "@/app/features/auth/components/auth-gateway";
import { AuthKernelProvider } from "@/app/features/auth-kernel/auth-kernel-provider";
import { DesktopProfileBootstrap } from "@/app/features/profiles/components/desktop-profile-bootstrap";
import { AppSessionShell } from "@/app/features/profiles/components/app-session-shell";
import { ProfilePickerChromeHost } from "@/app/features/profiles/components/profile-picker-chrome-context";
import { TitleBar } from "@/app/components/desktop/title-bar";
import { isMobileShellBuild } from "@/app/features/runtime/shell-contract";
import { StartupExperienceOverlay } from "@/app/features/runtime/components/startup-experience-overlay";
import { DevRuntimeIssueCapture } from "@/app/shared/dev-runtime-issue-capture";
import { logAppEvent } from "@/app/shared/log-app-event";
import { installM0TriageCapture } from "@/app/shared/m0-triage-capture";
import { installCodactrlAgentBridge } from "@/app/shared/codactrl-agent-bridge";
import { installM4StabilizationCapture } from "@/app/shared/m4-stabilization-capture";
import { installM6VoiceCapture } from "@/app/shared/m6-voice-capture";
import { installM6VoiceReplayBridge } from "@/app/shared/m6-voice-replay-bridge";
import { installM7AntiAbuseCapture } from "@/app/shared/m7-anti-abuse-capture";
import { installM7AntiAbuseReplayBridge } from "@/app/shared/m7-anti-abuse-replay-bridge";
import { installM8CommunityCapture } from "@/app/shared/m8-community-capture";
import { installM8CommunityReplayBridge } from "@/app/shared/m8-community-replay-bridge";
import { installM10TrustControlsBridge } from "@/app/shared/m10-trust-controls-bridge";
import { WindowRuntimeBindingOwner } from "@/app/features/runtime/components/window-runtime-binding-owner";
import { ChatStateDurabilityOwner } from "@/app/features/messaging/components/chat-state-durability-owner";
import { MessagePersistenceDurabilityOwner } from "@/app/features/messaging/components/message-persistence-durability-owner";
import { markExperimentShellBootFlag } from "@/app/features/runtime/experiment-shell-policy";
import { markDevLabBootFlag } from "@/app/features/dev-lab/dev-lab-policy";
import { installDevLab } from "@/app/features/dev-lab/dev-lab-install";
import { ExperimentShellIndicator } from "@/app/features/runtime/components/experiment-shell-indicator";
import { DevShellStampMismatchBanner } from "@/app/features/runtime/components/dev-shell-stamp-mismatch-banner";
import { ClientSurfaceRevisionBadge } from "@/app/components/client-surface-revision-badge";
import { DataRootUnavailableGate } from "@/app/features/profiles/components/data-root-unavailable-recovery";

const BOOT_WATCHDOG_LAST_EVENT_STORAGE_KEY = "obscur.boot.watchdog.auto_recovery_last_event.v1";

export const AppProviders = ({ children }: { children: React.ReactNode }) => {
    useEffect(() => {
        markExperimentShellBootFlag();
        markDevLabBootFlag();
        installDevLab();
        installM0TriageCapture();
        installM4StabilizationCapture();
        installM6VoiceCapture();
        installM6VoiceReplayBridge();
        installM7AntiAbuseCapture();
        installM7AntiAbuseReplayBridge();
        installM8CommunityCapture();
        installM8CommunityReplayBridge();
        installM10TrustControlsBridge();
        installCodactrlAgentBridge();
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }
        try {
            const raw = window.sessionStorage.getItem(BOOT_WATCHDOG_LAST_EVENT_STORAGE_KEY);
            if (!raw) {
                return;
            }
            window.sessionStorage.removeItem(BOOT_WATCHDOG_LAST_EVENT_STORAGE_KEY);
            const parsed = JSON.parse(raw) as Partial<{
                type: string;
                reason: string;
                attempt: number;
                atUnixMs: number;
            }>;
            if (parsed.type !== "auto_recovery_started") {
                return;
            }
            logAppEvent({
                name: "runtime.boot_watchdog_auto_recovery",
                level: "warn",
                scope: { feature: "runtime", action: "boot_watchdog" },
                context: {
                    reason: parsed.reason ?? "unknown",
                    attempt: typeof parsed.attempt === "number" && Number.isFinite(parsed.attempt) ? parsed.attempt : null,
                    startedAtUnixMs: typeof parsed.atUnixMs === "number" && Number.isFinite(parsed.atUnixMs) ? parsed.atUnixMs : null,
                    observedAtUnixMs: Date.now(),
                },
            });
        } catch {
            // Startup watchdog telemetry is best-effort only.
        }
    }, []);

    return (
        <DesktopProfileBootstrap>
            <WindowRuntimeBindingOwner />
            <ChatStateDurabilityOwner />
            <MessagePersistenceDurabilityOwner />
            <DevRuntimeIssueCapture />
            <DevShellStampMismatchBanner />
            <ExperimentShellIndicator />
            <ClientSurfaceRevisionBadge />
            <StartupExperienceOverlay />
            <ProfilePickerChromeHost>
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    {!isMobileShellBuild() ? (
                        <div className="relative z-[9999] shrink-0">
                            <TitleBar />
                        </div>
                    ) : null}
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                        <DataRootUnavailableGate>
                            <AuthKernelProvider>
                                <AuthGateway>
                                    <AppSessionShell>
                                        {children}
                                    </AppSessionShell>
                                </AuthGateway>
                            </AuthKernelProvider>
                        </DataRootUnavailableGate>
                    </div>
                </div>
            </ProfilePickerChromeHost>
        </DesktopProfileBootstrap>
    );
};
