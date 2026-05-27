import type { CommunityMode, RelayCapabilityTier } from "../types/community-mode";
import type { MembershipSyncMode } from "./community-membership-sync-mode";

export type CommunityDirectoryMaterializationHonesty = Readonly<{
    /** When false, UI must not imply relay-backed full member directory truth. */
    claimsAuthoritativeDirectory: boolean;
    summary: string;
    detail: string;
}>;

/**
 * P3.3 — Honest directory/roster copy from relay capability tier (no false full directory on Tier 1).
 */
export const resolveCommunityDirectoryMaterializationHonesty = (params: Readonly<{
    communityMode?: CommunityMode;
    relayCapabilityTier?: RelayCapabilityTier;
    membershipSyncMode?: MembershipSyncMode;
}>): CommunityDirectoryMaterializationHonesty => {
    const tier = params.relayCapabilityTier ?? "unconfigured";
    const isManaged = params.communityMode === "managed_workspace";
    const coordinationPreferred = params.membershipSyncMode === "coordination_preferred";
    const usesCoordinationDirectory = isManaged && coordinationPreferred;

    if (tier === "unconfigured") {
        return {
            claimsAuthoritativeDirectory: false,
            summary: "Participant list is local evidence only",
            detail: "Enable relays in Settings before treating this roster as relay-backed directory truth.",
        };
    }

    if (tier === "public_default") {
        const coordinationDetail = coordinationPreferred
            ? " Membership changes prefer the Obscur coordination directory when it is online; relay roster lines are hints only."
            : "";
        return {
            claimsAuthoritativeDirectory: false,
            summary: isManaged
                ? "Managed workspace directory is not available on public default relays"
                : coordinationPreferred
                    ? "Coordination directory with relay hints on public relays"
                    : "Best-effort participant discovery on public relays",
            detail: isManaged
                ? "Switch to a trusted or private relay baseline to materialize workspace-grade directory claims."
                : `Left/expelled members are applied on this device, but there is no exact live global roster on public relays.${coordinationDetail} Open Settings → Relays → Community membership sync for faster cross-device leave visibility when a coordination service is configured.`,
        };
    }

    if (tier === "trusted_private") {
        if (usesCoordinationDirectory) {
            return {
                claimsAuthoritativeDirectory: true,
                summary: "Coordination membership directory",
                detail:
                    "Join and leave are applied from the Obscur coordination directory on this device. Relay roster lines are chat-delivery hints only.",
            };
        }
        return {
            claimsAuthoritativeDirectory: !isManaged,
            summary: isManaged
                ? "Directory materialization is partial until coordination is configured"
                : "Trusted relay baseline — stronger roster materialization candidate",
            detail: isManaged
                ? "Enable coordination in Settings → Relays for workspace-grade membership authority."
                : "Custom relays improve discovery; exact live roster may still lag relay gossip.",
        };
    }

    if (usesCoordinationDirectory) {
        return {
            claimsAuthoritativeDirectory: true,
            summary: "Coordination membership directory",
            detail:
                "Join and leave are applied from the Obscur coordination directory on this device. Relay roster lines are chat-delivery hints only.",
        };
    }

    return {
        claimsAuthoritativeDirectory: true,
        summary: isManaged
            ? "Intranet relay — directory materialization candidate"
            : "Private relay — stronger directory sync candidate",
        detail: "Roster counts reflect relay and participation evidence merged on this device.",
    };
};
