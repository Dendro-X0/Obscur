import { describe, expect, it, beforeEach, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CommunityMembershipSyncSettingsPanel } from "./community-membership-sync-settings-panel";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (_key: string, fallback: string) => fallback,
    }),
}));

const syncModeState = vi.hoisted(() => ({
    mode: "nostr_only" as "nostr_only" | "coordination_preferred",
    coordinationConfigured: false,
    coordinationUrl: null as string | null,
}));

vi.mock("@/app/features/groups/services/community-membership-sync-mode", () => ({
    readMembershipSyncMode: () => syncModeState.mode,
    writeMembershipSyncMode: (mode: "nostr_only" | "coordination_preferred") => {
        syncModeState.mode = mode;
    },
    isCoordinationConfigured: () => syncModeState.coordinationConfigured,
    getCoordinationBaseUrl: () => syncModeState.coordinationUrl,
}));

vi.mock("@/app/features/runtime/use-mobile-compact-layout", () => ({
    useMobileCompactLayout: () => false,
}));

describe("CommunityMembershipSyncSettingsPanel", () => {
    beforeEach(() => {
        syncModeState.mode = "nostr_only";
        syncModeState.coordinationConfigured = false;
        syncModeState.coordinationUrl = null;
    });

    it("persists nostr_only when selected", () => {
        render(<CommunityMembershipSyncSettingsPanel />);
        fireEvent.click(screen.getByTestId("membership-sync-nostr-only"));
        expect(syncModeState.mode).toBe("nostr_only");
    });

    it("disables coordination option when coordination is not configured", () => {
        render(<CommunityMembershipSyncSettingsPanel />);
        expect(screen.getByTestId("membership-sync-coordination")).toBeDisabled();
    });

    it("allows coordination_preferred when coordination URL is configured", () => {
        syncModeState.coordinationConfigured = true;
        syncModeState.coordinationUrl = "http://127.0.0.1:8787";
        render(<CommunityMembershipSyncSettingsPanel />);
        fireEvent.click(screen.getByTestId("membership-sync-coordination"));
        expect(syncModeState.mode).toBe("coordination_preferred");
        expect(screen.getByTestId("coordination-url-display")).toHaveTextContent("127.0.0.1:8787");
    });
});
