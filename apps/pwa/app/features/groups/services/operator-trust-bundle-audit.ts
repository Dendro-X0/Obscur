/**
 * SEC-R1 — operator trust bundle audit for workspace create/join.
 * Canonical bundle: coordination URL + optional workspace relay (operator-trust-config).
 * Tier enforcement delegates to community-trust-policy (trusted_private | managed_intranet only).
 */
import type { RelayCapabilityTier } from "../types";
import {
    assessWorkspaceCommunityTrust,
    isWorkspaceRelayTierAllowed,
    type WorkspaceCommunityTrustAssessment,
    type WorkspaceCommunityTrustReasonCode,
} from "./community-trust-policy";
import {
    getCoordinationUrlSource,
    normalizeOperatorRelayUrl,
    readOperatorWorkspaceRelayUrl,
    resolveCoordinationBaseUrl,
    type CoordinationUrlSource,
} from "./operator-trust-config";
import { normalizeWorkspaceRelayUrl } from "./workspace-relay-url";

/** Documented allowed relay tiers for managed workspace operator bundle (SEC-R1). */
export const OPERATOR_TRUST_ALLOWED_WORKSPACE_RELAY_TIERS: ReadonlyArray<RelayCapabilityTier> = [
    "trusted_private",
    "managed_intranet",
];

export type OperatorTrustBundleInvalidReasonCode =
    | "bundle_invalid_coordination_url"
    | "bundle_invalid_relay_url"
    | "bundle_workspace_relay_missing";

export type OperatorTrustBundleAuditReasonCode =
    | WorkspaceCommunityTrustReasonCode
    | OperatorTrustBundleInvalidReasonCode;

export type OperatorTrustBundleSnapshot = Readonly<{
    coordinationUrl: string | null;
    coordinationSource: CoordinationUrlSource;
    workspaceRelayUrl: string | null;
    coordinationUrlValid: boolean;
    workspaceRelayUrlValid: boolean;
}>;

export type OperatorTrustBundleAudit = Readonly<{
    bundle: OperatorTrustBundleSnapshot;
    allowed: boolean;
    reasonCode: OperatorTrustBundleAuditReasonCode;
    userMessage: string;
    settingsHint: string;
    allowedRelayTiers: ReadonlyArray<RelayCapabilityTier>;
    workspaceTrust: Omit<WorkspaceCommunityTrustAssessment, "coordination"> & Readonly<{
        coordinationConfigured: boolean;
    }> | null;
}>;

const trimUrl = (raw: string): string => raw.trim().replace(/\/+$/, "");

export const isValidCoordinationBundleUrl = (url: string): boolean => {
    try {
        const parsed = new URL(trimUrl(url));
        return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
        return false;
    }
};

export const isValidWorkspaceRelayBundleUrl = (url: string): boolean => {
    const trimmed = url.trim();
    if (!/^wss?:\/\//i.test(trimmed)) {
        return false;
    }
    try {
        const parsed = new URL(normalizeOperatorRelayUrl(trimmed));
        return parsed.protocol === "ws:" || parsed.protocol === "wss:";
    } catch {
        return false;
    }
};

export const readOperatorTrustBundleSnapshot = (): OperatorTrustBundleSnapshot => {
    const coordinationUrl = resolveCoordinationBaseUrl();
    const workspaceRelayUrl = readOperatorWorkspaceRelayUrl();
    return {
        coordinationUrl,
        coordinationSource: getCoordinationUrlSource(),
        workspaceRelayUrl,
        coordinationUrlValid: coordinationUrl ? isValidCoordinationBundleUrl(coordinationUrl) : false,
        workspaceRelayUrlValid: workspaceRelayUrl ? isValidWorkspaceRelayBundleUrl(workspaceRelayUrl) : false,
    };
};

/**
 * Audit operator trust bundle before workspace create/join.
 * Validates bundle URLs, then runs canonical tier gate on the workspace relay when set.
 */
export const auditOperatorTrustBundle = (params: Readonly<{
    enabledRelayUrls?: ReadonlyArray<string>;
    coordinationHealthy?: boolean;
    requireWorkspaceRelay?: boolean;
    communityRelayUrlOverride?: string | null;
}>): OperatorTrustBundleAudit => {
    const bundle = readOperatorTrustBundleSnapshot();
    const allowedRelayTiers = OPERATOR_TRUST_ALLOWED_WORKSPACE_RELAY_TIERS;
    const relayForTrust = params.communityRelayUrlOverride?.trim()
        || bundle.workspaceRelayUrl
        || "";

    if (!bundle.coordinationUrl) {
        const workspaceTrust = assessWorkspaceCommunityTrust({
            communityRelayUrl: relayForTrust || "wss://127.0.0.1:1",
            enabledRelayUrls: params.enabledRelayUrls,
            coordinationHealthy: params.coordinationHealthy,
        });
        return {
            bundle,
            allowed: false,
            reasonCode: workspaceTrust.reasonCode,
            userMessage: workspaceTrust.userMessage,
            settingsHint: workspaceTrust.settingsHint,
            allowedRelayTiers,
            workspaceTrust,
        };
    }

    if (!bundle.coordinationUrlValid) {
        return {
            bundle,
            allowed: false,
            reasonCode: "bundle_invalid_coordination_url",
            userMessage: "Coordination URL must use http:// or https://.",
            settingsHint: "Update operator setup in Settings → Operator trust (e.g. http://127.0.0.1:8787).",
            allowedRelayTiers,
            workspaceTrust: null,
        };
    }

    if (bundle.workspaceRelayUrl && !bundle.workspaceRelayUrlValid) {
        return {
            bundle,
            allowed: false,
            reasonCode: "bundle_invalid_relay_url",
            userMessage: "Workspace relay URL must use ws:// or wss://.",
            settingsHint: "Update the operator workspace relay in Settings → Operator trust.",
            allowedRelayTiers,
            workspaceTrust: null,
        };
    }

    if (params.requireWorkspaceRelay && !bundle.workspaceRelayUrl && !params.communityRelayUrlOverride?.trim()) {
        return {
            bundle,
            allowed: false,
            reasonCode: "bundle_workspace_relay_missing",
            userMessage: "Configure an operator workspace relay before creating managed workspace communities.",
            settingsHint: "Complete Settings → Operator trust with a private relay URL.",
            allowedRelayTiers,
            workspaceTrust: null,
        };
    }

    const workspaceTrust = assessWorkspaceCommunityTrust({
        communityRelayUrl: relayForTrust || "wss://127.0.0.1:1",
        enabledRelayUrls: params.enabledRelayUrls,
        coordinationHealthy: params.coordinationHealthy,
    });

    const tierAllowed = isWorkspaceRelayTierAllowed(workspaceTrust.relayAssessment.tier);

    return {
        bundle,
        allowed: workspaceTrust.allowed && tierAllowed,
        reasonCode: workspaceTrust.allowed
            ? (tierAllowed ? "allowed" : "public_relay_blocked")
            : workspaceTrust.reasonCode,
        userMessage: workspaceTrust.allowed && !tierAllowed
            ? "Public relays cannot host workspace communities. Use a trusted private or intranet relay."
            : workspaceTrust.userMessage,
        settingsHint: workspaceTrust.settingsHint,
        allowedRelayTiers,
        workspaceTrust,
    };
};

/** Resolve relay URL for create/join: explicit selection wins, then operator bundle. */
export const resolveWorkspaceActionRelayUrl = (params: Readonly<{
    explicitRelayUrl?: string | null;
}>): string | null => {
    const explicit = params.explicitRelayUrl?.trim();
    if (explicit) {
        return normalizeWorkspaceRelayUrl(explicit);
    }
    const operatorRelay = readOperatorWorkspaceRelayUrl();
    return operatorRelay ? normalizeOperatorRelayUrl(operatorRelay) : null;
};

export const operatorTrustBundleHostFromRelayUrl = (relayUrl: string): string => (
    relayUrl.replace(/^wss?:\/\//i, "").replace(/\/$/, "")
);
