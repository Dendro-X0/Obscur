import type { RelayCapabilityTier } from "../types";
import {
    assessRelayCapability,
    type RelayCapabilityAssessment,
} from "./community-mode-contract";
import {
    probeCoordinationHealth,
    type CoordinationHealthSnapshot,
} from "./community-coordination-health";
import { isCoordinationConfigured } from "./community-membership-sync-mode";
import { hasWritableCommunityRelayTransport } from "./community-relay-transport";
import {
    isCoordinationGateSatisfied,
    isCoordinationOnlyWorkspaceDevMode,
} from "./community-dev-flags";

export type WorkspaceCommunityTrustReasonCode =
    | "allowed"
    | "coordination_unconfigured"
    | "coordination_unreachable"
    | "public_relay_blocked"
    | "relay_unconfigured";

export type WorkspaceCommunityTrustAssessment = Readonly<{
    allowed: boolean;
    reasonCode: WorkspaceCommunityTrustReasonCode;
    userMessage: string;
    settingsHint: string;
    relayAssessment: RelayCapabilityAssessment;
    coordination: CoordinationHealthSnapshot;
    requiresManagedWorkspace: true;
}>;

const normalizeCommunityRelayUrl = (raw: string): string => {
    const trimmed = raw.trim();
    if (!trimmed) {
        return "";
    }
    return /^wss?:\/\//i.test(trimmed) ? trimmed : `wss://${trimmed}`;
};

const relayHostFromUrl = (relayUrl: string): string | null => {
    try {
        return new URL(normalizeCommunityRelayUrl(relayUrl)).hostname.toLowerCase();
    } catch {
        return relayUrl.replace(/^wss?:\/\//i, "").replace(/\/.*$/, "").toLowerCase() || null;
    }
};

/**
 * Canonical synchronous gate for **new** workspace community create/join UI.
 * Requires coordination URL + healthy `/health` + non–public-default community relay.
 */
export const assessWorkspaceCommunityTrust = (params: Readonly<{
    communityRelayUrl: string;
    enabledRelayUrls?: ReadonlyArray<string>;
    coordinationHealthy?: boolean;
}>): Omit<WorkspaceCommunityTrustAssessment, "coordination"> & Readonly<{
    coordinationConfigured: boolean;
}> => {
    const relayUrl = normalizeCommunityRelayUrl(params.communityRelayUrl);
    const relayAssessment = assessRelayCapability({
        enabledRelayUrls: params.enabledRelayUrls ?? [],
        selectedRelayHost: relayHostFromUrl(relayUrl),
    });

    const coordinationConfigured = isCoordinationConfigured();
    const probedHealthy: boolean | null = params.coordinationHealthy === true
        ? true
        : params.coordinationHealthy === false
            ? false
            : null;
    const coordinationHealthy = isCoordinationGateSatisfied(probedHealthy);

    if (!coordinationConfigured) {
        return {
            allowed: false,
            reasonCode: "coordination_unconfigured",
            userMessage: "Workspace communities require a coordination service. Set NEXT_PUBLIC_COORDINATION_URL when building the app, then restart.",
            settingsHint: "Local dev: run `pnpm -C apps/coordination dev` and set coordination URL to http://127.0.0.1:8787 in apps/pwa/.env.local.",
            relayAssessment,
            coordinationConfigured,
            requiresManagedWorkspace: true,
        };
    }

    if (!coordinationHealthy) {
        return {
            allowed: false,
            reasonCode: "coordination_unreachable",
            userMessage: "Coordination service is not reachable. Start the coordination worker before creating or joining workspace communities.",
            settingsHint: "Run `pnpm -C apps/coordination dev` and confirm GET /health returns ok:true.",
            relayAssessment,
            coordinationConfigured,
            requiresManagedWorkspace: true,
        };
    }

    if (relayAssessment.tier === "unconfigured" || !relayUrl) {
        return {
            allowed: false,
            reasonCode: "relay_unconfigured",
            userMessage: "Choose a trusted community relay host (private, intranet, or operator-controlled)—not an empty host.",
            settingsHint: "Add and enable a non-public relay in Settings → Relays, or use a localhost/intranet host for development.",
            relayAssessment,
            coordinationConfigured,
            requiresManagedWorkspace: true,
        };
    }

    if (!hasWritableCommunityRelayTransport(relayUrl)) {
        if (isCoordinationOnlyWorkspaceDevMode() && coordinationHealthy) {
            return {
                allowed: true,
                reasonCode: "allowed",
                userMessage: "",
                settingsHint: "Coordination-only dev mode: membership directory tests work without a local Nostr relay. For chat, enable a public relay (e.g. wss://relay.damus.io) in Settings → Relays.",
                relayAssessment,
                coordinationConfigured,
                requiresManagedWorkspace: true,
            };
        }
        return {
            allowed: false,
            reasonCode: "relay_unconfigured",
            userMessage: "Relay host must be a reachable Nostr relay (e.g. wss://relay.damus.io in Settings → Relays). Local Docker relay is optional.",
            settingsHint: "Or set NEXT_PUBLIC_DEV_COORDINATION_ONLY_WORKSPACE=true in apps/pwa/.env.local to test membership without Docker.",
            relayAssessment,
            coordinationConfigured,
            requiresManagedWorkspace: true,
        };
    }

    if (relayAssessment.tier === "public_default") {
        return {
            allowed: false,
            reasonCode: "public_relay_blocked",
            userMessage: "Public relays (nos.lol, damus.io, groups.fiatjaf.com, etc.) cannot host workspace membership. Use a trusted private relay plus coordination.",
            settingsHint: "Disable public-default hosts for community scope; add your team relay URL in Settings → Relays.",
            relayAssessment,
            coordinationConfigured,
            requiresManagedWorkspace: true,
        };
    }

    return {
        allowed: true,
        reasonCode: "allowed",
        userMessage: "",
        settingsHint: "Membership is owned by the coordination directory; the community relay carries encrypted chat only.",
        relayAssessment,
        coordinationConfigured,
        requiresManagedWorkspace: true,
    };
};

export const assessWorkspaceCommunityTrustAsync = async (params: Readonly<{
    communityRelayUrl: string;
    enabledRelayUrls?: ReadonlyArray<string>;
}>): Promise<WorkspaceCommunityTrustAssessment> => {
    const coordination = await probeCoordinationHealth();
    const base = assessWorkspaceCommunityTrust({
        communityRelayUrl: params.communityRelayUrl,
        enabledRelayUrls: params.enabledRelayUrls,
        coordinationHealthy: coordination.healthy,
    });
    return {
        ...base,
        coordination,
    };
};

export const isWorkspaceRelayTierAllowed = (tier: RelayCapabilityTier): boolean => (
    tier === "trusted_private" || tier === "managed_intranet"
);
