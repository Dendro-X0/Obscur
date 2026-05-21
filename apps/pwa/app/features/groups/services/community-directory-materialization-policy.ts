import type { CommunityMode, RelayCapabilityTier } from "../types/community-mode";

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
}>): CommunityDirectoryMaterializationHonesty => {
    const tier = params.relayCapabilityTier ?? "unconfigured";
    const isManaged = params.communityMode === "managed_workspace";

    if (tier === "unconfigured") {
        return {
            claimsAuthoritativeDirectory: false,
            summary: "Participant list is local evidence only",
            detail: "Enable relays in Settings before treating this roster as relay-backed directory truth.",
        };
    }

    if (tier === "public_default") {
        return {
            claimsAuthoritativeDirectory: false,
            summary: isManaged
                ? "Managed workspace directory is not available on public default relays"
                : "Best-effort participant discovery on public relays",
            detail: isManaged
                ? "Switch to a trusted or private relay baseline to materialize workspace-grade directory claims."
                : "Left/expelled members are applied, but live global roster parity is not guaranteed on public relays.",
        };
    }

    if (tier === "trusted_private") {
        return {
            claimsAuthoritativeDirectory: !isManaged,
            summary: isManaged
                ? "Directory materialization is partial until relay contracts are fully satisfied"
                : "Trusted relay baseline — stronger roster materialization candidate",
            detail: isManaged
                ? "Use an intranet or operator-controlled relay for authoritative managed directory behavior."
                : "Custom relays improve discovery; exact live roster may still lag relay gossip.",
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
