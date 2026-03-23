"use client";

import React, { useEffect } from "react";
import { AuthGateway } from "@/app/features/auth/components/auth-gateway";
import { DesktopProfileBootstrap } from "@/app/features/profiles/components/desktop-profile-bootstrap";
import { UnlockedAppRuntimeShell } from "@/app/features/runtime/components/unlocked-app-runtime-shell";
import { StartupExperienceOverlay } from "@/app/features/runtime/components/startup-experience-overlay";
import { DevRuntimeIssueCapture } from "@/app/shared/dev-runtime-issue-capture";
import { logAppEvent } from "@/app/shared/log-app-event";
import { installM0TriageCapture } from "@/app/shared/m0-triage-capture";
import { installM4StabilizationCapture } from "@/app/shared/m4-stabilization-capture";
import { installM6VoiceCapture } from "@/app/shared/m6-voice-capture";

const BOOT_WATCHDOG_LAST_EVENT_STORAGE_KEY = "obscur.boot.watchdog.auto_recovery_last_event.v1";

export const AppProviders = ({ children }: { children: React.ReactNode }) => {
    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }
        const globalRoot = window as Window & {
            __obscurBootReady?: boolean;
        };
        globalRoot.__obscurBootReady = true;
        installM0TriageCapture();
        installM4StabilizationCapture();
        installM6VoiceCapture();
        window.dispatchEvent(new Event("obscur:boot-ready"));
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
            <DevRuntimeIssueCapture />
            <StartupExperienceOverlay />
            <AuthGateway>
                <UnlockedAppRuntimeShell>
                    {children}
                </UnlockedAppRuntimeShell>
            </AuthGateway>
        </DesktopProfileBootstrap>
    );
};
