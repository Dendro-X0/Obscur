import type { MembershipSyncMode } from "../services/community-membership-sync-mode";
import type { CommunityMemberEvidenceTier } from "./community-member-evidence-tier";

export type MembershipEvidenceUiContext = Readonly<{
    membershipSyncMode: MembershipSyncMode;
}>;

export type MembershipEvidenceChipVariant =
    | "terminal"
    | "provisional"
    | "relay_hint"
    | "directory_sync";

export type MembershipEvidenceChipPresentation = Readonly<{
    variant: MembershipEvidenceChipVariant;
    labelKey: string;
    labelDefault: string;
    hintKey: string;
    hintDefault: string;
}>;

/**
 * v1.9.3 B3 — Honest chip copy: relay roster is a hint on sovereign paths;
 * coordination_preferred uses directory-oriented labels for relay-backed tiers.
 */
export const resolveMembershipEvidenceChipPresentation = (
    tier: CommunityMemberEvidenceTier,
    context: MembershipEvidenceUiContext,
): MembershipEvidenceChipPresentation => {
    if (tier === "terminal") {
        return {
            variant: "terminal",
            labelKey: "groups.membershipEvidence.terminal",
            labelDefault: "Terminal",
            hintKey: "groups.membershipEvidence.terminalHint",
            hintDefault:
                "Excluded from the active roster by leave or expulsion evidence (local cache and/or relay).",
        };
    }

    if (tier === "provisional") {
        const provisionalHint = context.membershipSyncMode === "coordination_preferred"
            ? {
                hintKey: "groups.membershipEvidence.provisionalHintCoordination",
                hintDefault:
                    "Shown from local chat or invite evidence until the coordination directory or relay hints align on this device.",
            }
            : {
                hintKey: "groups.membershipEvidence.provisionalHint",
                hintDefault:
                    "Shown from local chat/invite evidence until relay roster hints catch up.",
            };
        return {
            variant: "provisional",
            labelKey: "groups.membershipEvidence.provisional",
            labelDefault: "Provisional",
            ...provisionalHint,
        };
    }

    if (context.membershipSyncMode === "coordination_preferred") {
        return {
            variant: "directory_sync",
            labelKey: "groups.membershipEvidence.directorySync",
            labelDefault: "Directory",
            hintKey: "groups.membershipEvidence.directorySyncHint",
            hintDefault:
                "Listed from relay or coordination directory evidence on this device — not a live global roster guarantee.",
        };
    }

    return {
        variant: "relay_hint",
        labelKey: "groups.membershipEvidence.relayHint",
        labelDefault: "Relay hint",
        hintKey: "groups.membershipEvidence.relayHintHint",
        hintDefault:
            "Relay-backed membership hint only — public relays do not guarantee an exact live roster.",
    };
};
