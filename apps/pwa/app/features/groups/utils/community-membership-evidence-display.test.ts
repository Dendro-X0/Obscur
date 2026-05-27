import { describe, expect, it } from "vitest";
import { resolveMembershipEvidenceChipPresentation } from "./community-membership-evidence-display";

describe("resolveMembershipEvidenceChipPresentation", () => {
    it("uses relay hint label on nostr_only for relay-backed tier", () => {
        const presentation = resolveMembershipEvidenceChipPresentation("relay_confirmed", {
            membershipSyncMode: "nostr_only",
        });
        expect(presentation.variant).toBe("relay_hint");
        expect(presentation.labelDefault).toBe("Relay hint");
    });

    it("uses directory label on coordination_preferred for relay-backed tier", () => {
        const presentation = resolveMembershipEvidenceChipPresentation("relay_confirmed", {
            membershipSyncMode: "coordination_preferred",
        });
        expect(presentation.variant).toBe("directory_sync");
        expect(presentation.labelDefault).toBe("Directory");
    });

    it("uses coordination-oriented provisional hint when coordination_preferred", () => {
        const presentation = resolveMembershipEvidenceChipPresentation("provisional", {
            membershipSyncMode: "coordination_preferred",
        });
        expect(presentation.hintKey).toBe("groups.membershipEvidence.provisionalHintCoordination");
    });

    it("keeps terminal and provisional variants unchanged", () => {
        expect(
            resolveMembershipEvidenceChipPresentation("terminal", {
                membershipSyncMode: "coordination_preferred",
            }).variant,
        ).toBe("terminal");
        expect(
            resolveMembershipEvidenceChipPresentation("provisional", {
                membershipSyncMode: "nostr_only",
            }).variant,
        ).toBe("provisional");
    });
});
