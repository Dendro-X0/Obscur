export type CommunityMode = "sovereign_room" | "managed_workspace";

/** Where the community is hosted — honesty for T0 vs T1 (CU-UX-2b). */
export type CommunityHostingTier = "public_quiet" | "operator" | "custom";

export type RelayCapabilityTier =
    | "unconfigured"
    | "public_default"
    | "trusted_private"
    | "managed_intranet";
