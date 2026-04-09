import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AutoLockSettingsPanel } from "./auto-lock-settings-panel";
import { defaultPrivacySettings, type PrivacySettings } from "../services/privacy-settings-service";

const settingsPanelMocks = vi.hoisted(() => ({
    settings: {} as PrivacySettings,
    updateSettings: vi.fn(),
    setAttackModeSafetyProfile: vi.fn(),
    ingestSignedSharedIntelSignals: vi.fn(),
    getSignedSharedIntelSignals: vi.fn(),
    setSignedSharedIntelSignals: vi.fn(),
    clearSignedSharedIntelSignals: vi.fn(),
    logAppEvent: vi.fn(),
    currentSignals: [] as Array<Record<string, unknown>>,
}));

const createDefaultSettings = (): PrivacySettings => ({
    ...defaultPrivacySettings,
    attackModeSafetyProfileV121: "standard",
});

const createSignal = (signalId: string): Record<string, unknown> => ({
    version: "obscur.m10.shared_intel.v1",
    signalId,
    subjectType: "relay_host",
    subjectValue: "relay.bad.example",
    disposition: "block",
    confidenceScore: 90,
    reasonCode: "relay_known_spam_cluster",
    issuedAtUnixMs: 1_000,
    expiresAtUnixMs: Date.now() + 30_000,
    signerPublicKeyHex: "f".repeat(64),
    signatureHex: "signed",
});

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (
            key: string,
            fallbackOrOptions?: string | Record<string, unknown>,
            maybeOptions?: Record<string, unknown>,
        ) => {
            const template = typeof fallbackOrOptions === "string" ? fallbackOrOptions : key;
            const options = (typeof fallbackOrOptions === "object" ? fallbackOrOptions : maybeOptions) ?? {};
            return template.replace(/\{\{\s*([^\s}]+)\s*\}\}/g, (_match, token: string) => String(options[token] ?? ""));
        },
    }),
}));

vi.mock("../hooks/use-auto-lock", () => ({
    useAutoLock: () => ({
        settings: settingsPanelMocks.settings,
        updateSettings: settingsPanelMocks.updateSettings,
        torStatus: "disconnected" as const,
        torStatusSnapshot: null,
        torLogs: [] as string[],
        torRestartRequired: false,
    }),
}));

vi.mock("@/app/features/runtime/runtime-capabilities", () => ({
    getRuntimeCapabilities: () => ({ isNativeRuntime: false }),
}));

vi.mock("@/app/features/runtime/native-adapters", () => ({
    invokeNativeCommand: vi.fn(async () => ({ ok: true, value: undefined })),
}));

vi.mock("@/app/features/messaging/services/m10-shared-intel-policy", () => ({
    setAttackModeSafetyProfile: (profile: "standard" | "strict") => settingsPanelMocks.setAttackModeSafetyProfile(profile),
    ingestSignedSharedIntelSignals: (params: { signals?: unknown[]; replaceExisting?: boolean }) => {
        settingsPanelMocks.ingestSignedSharedIntelSignals(params);
        if (params.replaceExisting) {
            settingsPanelMocks.currentSignals = [createSignal("imported-replaced")];
        } else {
            settingsPanelMocks.currentSignals = [...settingsPanelMocks.currentSignals, createSignal("imported-added")];
        }
        return {
            acceptedCount: 1,
            rejectedCount: 0,
            storedSignalCount: settingsPanelMocks.currentSignals.length,
            rejectedByReason: {
                invalid_shape: 0,
                expired: 0,
                missing_signature_verifier: 0,
                invalid_signature: 0,
            },
            rejectedSignalIdSamples: [],
        };
    },
    getSignedSharedIntelSignals: () => {
        settingsPanelMocks.getSignedSharedIntelSignals();
        return settingsPanelMocks.currentSignals;
    },
    setSignedSharedIntelSignals: (signals: Array<Record<string, unknown>>) => {
        settingsPanelMocks.setSignedSharedIntelSignals(signals);
        settingsPanelMocks.currentSignals = [...signals];
    },
    clearSignedSharedIntelSignals: () => {
        settingsPanelMocks.clearSignedSharedIntelSignals();
        settingsPanelMocks.currentSignals = [];
    },
}));

vi.mock("@/app/shared/log-app-event", () => ({
    logAppEvent: (params: unknown) => settingsPanelMocks.logAppEvent(params),
}));

describe("AutoLockSettingsPanel M10 trust controls", () => {
    beforeEach(() => {
        settingsPanelMocks.settings = createDefaultSettings();
        settingsPanelMocks.updateSettings.mockReset();
        settingsPanelMocks.setAttackModeSafetyProfile.mockReset();
        settingsPanelMocks.ingestSignedSharedIntelSignals.mockReset();
        settingsPanelMocks.getSignedSharedIntelSignals.mockReset();
        settingsPanelMocks.setSignedSharedIntelSignals.mockReset();
        settingsPanelMocks.clearSignedSharedIntelSignals.mockReset();
        settingsPanelMocks.logAppEvent.mockReset();
        settingsPanelMocks.currentSignals = [createSignal("signal-export-1")];
    });

    it("switches attack-mode profile to strict through canonical policy service", () => {
        render(<AutoLockSettingsPanel />);
        fireEvent.click(screen.getByRole("button", { name: "Set attack mode profile to strict" }));
        expect(settingsPanelMocks.setAttackModeSafetyProfile).toHaveBeenCalledWith("strict");
        expect(settingsPanelMocks.logAppEvent).toHaveBeenCalled();
    });

    it("imports signed shared-intel JSON using selected ingest options", () => {
        render(<AutoLockSettingsPanel />);

        fireEvent.change(screen.getByLabelText("Shared intel JSON payload"), {
            target: {
                value: JSON.stringify({
                    signals: [{ signalId: "import-1", version: "obscur.m10.shared_intel.v1" }],
                }),
            },
        });
        fireEvent.click(screen.getByRole("button", { name: "Import JSON" }));

        expect(settingsPanelMocks.ingestSignedSharedIntelSignals).toHaveBeenCalledWith({
            signals: [{ signalId: "import-1", version: "obscur.m10.shared_intel.v1" }],
            replaceExisting: false,
            requireSignatureVerification: true,
        });
        expect(screen.getByText(/Imported signals: accepted 1/)).toBeInTheDocument();
        expect(settingsPanelMocks.logAppEvent).toHaveBeenCalled();
    });

    it("exports shared-intel signals JSON into the editor textarea", () => {
        render(<AutoLockSettingsPanel />);
        fireEvent.click(screen.getByRole("button", { name: "Export JSON" }));

        const textarea = screen.getByLabelText("Shared intel JSON payload") as HTMLTextAreaElement;
        expect(textarea.value).toContain("signal-export-1");
    });

    it("supports undo after import by restoring previous signal state", () => {
        render(<AutoLockSettingsPanel />);

        fireEvent.change(screen.getByLabelText("Shared intel JSON payload"), {
            target: {
                value: JSON.stringify({
                    signals: [{ signalId: "import-2", version: "obscur.m10.shared_intel.v1" }],
                }),
            },
        });
        fireEvent.click(screen.getByRole("button", { name: "Import JSON" }));
        fireEvent.click(screen.getByRole("button", { name: "Undo Last Change" }));

        expect(settingsPanelMocks.setSignedSharedIntelSignals).toHaveBeenCalled();
        expect(screen.getByText("Reverted the latest shared-intel trust-control change.")).toBeInTheDocument();
    });
});
