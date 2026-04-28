import type { CommunityMode, RelayCapabilityTier } from "../types/community-mode";

type CommunityModeDefinition = Readonly<{
    mode: CommunityMode;
    label: string;
    shortDescription: string;
    guarantees: ReadonlyArray<string>;
    caution: string;
}>;

export type RelayCapabilityAssessment = Readonly<{
    tier: RelayCapabilityTier;
    label: string;
    summary: string;
    settingsHint: string;
    recommendedMode: CommunityMode;
    supportsManagedWorkspace: boolean;
    selectedRelayHost: string | null;
    enabledRelayCount: number;
}>;

const PUBLIC_DEFAULT_RELAY_HOSTS = new Set<string>([
    "relay.damus.io",
    "nos.lol",
    "relay.primal.net",
    "relay.snort.social",
    "relay.nostr.band",
    "groups.fiatjaf.com",
]);

const PRIVATE_IPV4_RANGES: ReadonlyArray<Readonly<{ prefix: string; nextOctetRange?: Readonly<[number, number]> }>> = [
    { prefix: "10." },
    { prefix: "127." },
    { prefix: "192.168." },
    { prefix: "169.254." },
    { prefix: "172.", nextOctetRange: [16, 31] },
];

export const COMMUNITY_MODE_DEFINITIONS: Readonly<Record<CommunityMode, CommunityModeDefinition>> = {
    sovereign_room: {
        mode: "sovereign_room",
        label: "Sovereign Room",
        shortDescription: "Private room defaults that stay honest on public or mixed relay setups.",
        guarantees: [
            "Encrypted community chat",
            "Reload-stable room access",
            "Best-effort participant discovery",
            "Relay-configurable operation",
        ],
        caution: "Does not promise an exact live member roster or workspace-grade directory controls.",
    },
    managed_workspace: {
        mode: "managed_workspace",
        label: "Managed Workspace",
        shortDescription: "Advanced team coordination mode for trusted or operator-controlled relay environments.",
        guarantees: [
            "Encrypted community chat",
            "Relay-backed directory candidate",
            "Stronger team coordination affordances",
            "Operationally managed relay assumptions",
        ],
        caution: "Only choose this when your relay environment is deliberately controlled and your team accepts the stronger setup requirements.",
    },
};

const normalizeRelayHost = (value: string | null | undefined): string | null => {
    const trimmed = value?.trim();
    if (!trimmed) {
        return null;
    }

    const candidate = /^wss?:\/\//i.test(trimmed) ? trimmed : `wss://${trimmed}`;

    try {
        return new URL(candidate).hostname.toLowerCase();
    } catch {
        return trimmed
            .replace(/^wss?:\/\//i, "")
            .replace(/\/.*$/, "")
            .toLowerCase();
    }
};

const isPrivateIpv4Host = (hostname: string): boolean => {
    const normalized = hostname.trim().toLowerCase();
    return PRIVATE_IPV4_RANGES.some((range) => {
        if (!normalized.startsWith(range.prefix)) {
            return false;
        }
        if (!range.nextOctetRange) {
            return true;
        }
        const octets = normalized.split(".");
        const nextOctet = Number(octets[1]);
        if (!Number.isFinite(nextOctet)) {
            return false;
        }
        return nextOctet >= range.nextOctetRange[0] && nextOctet <= range.nextOctetRange[1];
    });
};

const isPrivateRelayHost = (hostname: string): boolean => {
    const normalized = hostname.trim().toLowerCase();
    if (!normalized) {
        return false;
    }

    if (
        normalized === "localhost"
        || normalized.endsWith(".local")
        || normalized.endsWith(".internal")
        || normalized.endsWith(".lan")
        || normalized.endsWith(".home")
    ) {
        return true;
    }

    if (normalized.includes(":")) {
        return normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:");
    }

    return isPrivateIpv4Host(normalized);
};

export const assessRelayCapability = (params: Readonly<{
    enabledRelayUrls: ReadonlyArray<string>;
    selectedRelayHost?: string | null;
}>): RelayCapabilityAssessment => {
    const selectedRelayHost = normalizeRelayHost(params.selectedRelayHost);
    const normalizedEnabledHosts = Array.from(new Set(
        params.enabledRelayUrls
            .map((relayUrl) => normalizeRelayHost(relayUrl))
            .filter((value): value is string => Boolean(value)),
    ));
    const candidateHosts = Array.from(new Set([
        ...normalizedEnabledHosts,
        ...(selectedRelayHost ? [selectedRelayHost] : []),
    ]));

    if (candidateHosts.length === 0) {
        return {
            tier: "unconfigured",
            label: "No Relay Baseline",
            summary: "No enabled relay baseline is visible, so the app should stay on the safest community guarantees.",
            settingsHint: "Enable at least one relay in Settings before attempting stronger community coordination guarantees.",
            recommendedMode: "sovereign_room",
            supportsManagedWorkspace: false,
            selectedRelayHost,
            enabledRelayCount: params.enabledRelayUrls.length,
        };
    }

    const allKnownPublicDefaults = candidateHosts.every((host) => PUBLIC_DEFAULT_RELAY_HOSTS.has(host));
    if (allKnownPublicDefaults) {
        return {
            tier: "public_default",
            label: "Public Default",
            summary: "This relay baseline matches the low-friction public/default path, so Sovereign Room is the honest default.",
            settingsHint: "Use Settings -> Relays if you want to move into a trusted or workspace-style relay environment later.",
            recommendedMode: "sovereign_room",
            supportsManagedWorkspace: false,
            selectedRelayHost,
            enabledRelayCount: params.enabledRelayUrls.length,
        };
    }

    const allPrivateRelayHosts = candidateHosts.every((host) => isPrivateRelayHost(host));
    if (allPrivateRelayHosts) {
        return {
            tier: "managed_intranet",
            label: "Intranet Workspace Candidate",
            summary: "The selected relay baseline looks private or operator-controlled, so Managed Workspace can be offered as an advanced path.",
            settingsHint: "Keep stronger workspace claims tied to the actual private relay deployment and validate them before promising them broadly.",
            recommendedMode: "managed_workspace",
            supportsManagedWorkspace: true,
            selectedRelayHost,
            enabledRelayCount: params.enabledRelayUrls.length,
        };
    }

    return {
        tier: "trusted_private",
        label: "Trusted Relay Candidate",
        summary: "The relay baseline includes custom relays beyond the public defaults, which can justify an advanced managed-workspace path when operators are trusted.",
        settingsHint: "Treat Managed Workspace as opt-in only for teams that intentionally configured these relays and accept the extra operational assumptions.",
        recommendedMode: "sovereign_room",
        supportsManagedWorkspace: true,
        selectedRelayHost,
        enabledRelayCount: params.enabledRelayUrls.length,
    };
};

export const getCommunityModeDefinition = (mode: CommunityMode): CommunityModeDefinition => (
    COMMUNITY_MODE_DEFINITIONS[mode]
);
