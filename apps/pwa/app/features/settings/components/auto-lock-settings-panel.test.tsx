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
    clearSignedSharedIntelSignals: vi.fn(),
}));

const createDefaultSettings = (): PrivacySettings => ({
    ...defaultPrivacySettings,
    attackModeSafetyProfileV121: "standard",
});

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string) => fallback ?? key,
    }),
}));

vi.mock("../hooks/use-auto-lock", () => ({
    useAutoLock: () => ({
        settings: settingsPanelMocks.settings,
        updateSettings: settingsPanelMocks.updateSettings,
        torStatus: "disconnected" as const,
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
    ingestSignedSharedIntelSignals: (params: unknown) => settingsPanelMocks.ingestSignedSharedIntelSignals(params),
    getSignedSharedIntelSignals: () => settingsPanelMocks.getSignedSharedIntelSignals(),
    clearSignedSharedIntelSignals: () => settingsPanelMocks.clearSignedSharedIntelSignals(),
}));

describe("AutoLockSettingsPanel M10 trust controls", () => {
    beforeEach(() => {
        settingsPanelMocks.settings = createDefaultSettings();
        settingsPanelMocks.updateSettings.mockReset();
        settingsPanelMocks.setAttackModeSafetyProfile.mockReset();
        settingsPanelMocks.ingestSignedSharedIntelSignals.mockReset();
        settingsPanelMocks.getSignedSharedIntelSignals.mockReset();
        settingsPanelMocks.clearSignedSharedIntelSignals.mockReset();

        settingsPanelMocks.ingestSignedSharedIntelSignals.mockReturnValue({
            acceptedCount: 1,
            rejectedCount: 0,
            storedSignalCount: 1,
            rejectedByReason: {
                invalid_shape: 0,
                expired: 0,
                missing_signature_verifier: 0,
                invalid_signature: 0,
            },
            rejectedSignalIdSamples: [],
        });
        settingsPanelMocks.getSignedSharedIntelSignals.mockReturnValue([
            {
                version: "obscur.m10.shared_intel.v1",
                signalId: "signal-export-1",
            },
        ]);
    });

    it("switches attack-mode profile to strict through canonical policy service", () => {
        render(<AutoLockSettingsPanel />);
        fireEvent.click(screen.getByRole("button", { name: "Set attack mode profile to strict" }));
        expect(settingsPanelMocks.setAttackModeSafetyProfile).toHaveBeenCalledWith("strict");
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
    });

    it("exports shared-intel signals JSON into the editor textarea", () => {
        render(<AutoLockSettingsPanel />);
        fireEvent.click(screen.getByRole("button", { name: "Export JSON" }));

        const textarea = screen.getByLabelText("Shared intel JSON payload") as HTMLTextAreaElement;
        expect(textarea.value).toContain("signal-export-1");
    });
});
