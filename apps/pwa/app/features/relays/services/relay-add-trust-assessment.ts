/**
 * SEC-R2 — canonical relay add trust assessment (Settings → Relays).
 * Combines URL validation, capability tier, and optional behavioral trust score.
 */
import {
  assessRelayCapability,
  normalizeRelayHost,
  type RelayCapabilityAssessment,
} from "@/app/features/groups/services/community-mode-contract";
import type { RelayCapabilityTier } from "@/app/features/groups/types/community-mode";
import { validateRelayUrl } from "@/app/features/relays/utils/validate-relay-url";
import {
  buildRelayScoreFromMetrics,
  type RelayMetrics,
  type RelayScore,
  type RelayTrustLevel,
} from "@/app/features/security/services/relay-trust-scorer";

export type RelayAddTrustReasonCode =
  | "invalid_url"
  | "allowed"
  | "public_default_notice"
  | "behavioral_untrusted";

export type RelayAddTrustAssessment = Readonly<{
  allowed: boolean;
  reasonCode: RelayAddTrustReasonCode;
  normalizedUrl: string | null;
  capabilityTier: RelayCapabilityTier;
  capability: RelayCapabilityAssessment;
  behavioralScore: RelayScore | null;
  behavioralTrustLevel: RelayTrustLevel | null;
  userMessage: string;
  settingsHint: string;
  showWorkspaceNotice: boolean;
}>;

export const assessRelayAddTrust = (params: Readonly<{
  rawUrl: string;
  enabledRelayUrls?: ReadonlyArray<string>;
  allowLocalhostWs?: boolean;
  existingBehavioralMetrics?: RelayMetrics | null;
  blockBehaviorallyUntrusted?: boolean;
}>): RelayAddTrustAssessment => {
  const validated = validateRelayUrl(params.rawUrl, {
    allowLocalhostWs: params.allowLocalhostWs ?? true,
  });
  if (!validated) {
    return {
      allowed: false,
      reasonCode: "invalid_url",
      normalizedUrl: null,
      capabilityTier: "unconfigured",
      capability: assessRelayCapability({ enabledRelayUrls: params.enabledRelayUrls ?? [] }),
      behavioralScore: null,
      behavioralTrustLevel: null,
      userMessage: "Enter a valid relay URL (wss://… or ws://localhost for dev).",
      settingsHint: "Relays must use wss:// in production, or ws://localhost / 127.0.0.1 in dev.",
      showWorkspaceNotice: false,
    };
  }

  const normalizedUrl = validated.normalizedUrl;
  const enabledRelayUrls = [
    ...(params.enabledRelayUrls ?? []),
    normalizedUrl,
  ];
  const selectedHost = normalizeRelayHost(normalizedUrl);
  const capability = assessRelayCapability({
    enabledRelayUrls,
    selectedRelayHost: selectedHost,
  });

  const behavioralScore = params.existingBehavioralMetrics
    ? buildRelayScoreFromMetrics({ ...params.existingBehavioralMetrics, url: normalizedUrl })
    : null;
  const behavioralTrustLevel = behavioralScore?.trustLevel ?? null;

  if (
    params.blockBehaviorallyUntrusted === true
    && behavioralTrustLevel === "untrusted"
  ) {
    return {
      allowed: false,
      reasonCode: "behavioral_untrusted",
      normalizedUrl,
      capabilityTier: capability.tier,
      capability,
      behavioralScore,
      behavioralTrustLevel,
      userMessage: "This relay is marked untrusted from prior delivery failures or your block report.",
      settingsHint: "Remove the relay from your list or reset relay metrics before re-adding.",
      showWorkspaceNotice: false,
    };
  }

  const showWorkspaceNotice = capability.tier === "public_default";

  return {
    allowed: true,
    reasonCode: showWorkspaceNotice ? "public_default_notice" : "allowed",
    normalizedUrl,
    capabilityTier: capability.tier,
    capability,
    behavioralScore,
    behavioralTrustLevel,
    userMessage: showWorkspaceNotice
      ? "Relay added for DM transport. Public relays cannot host managed workspace communities."
      : "Relay added.",
    settingsHint: showWorkspaceNotice
      ? capability.settingsHint
      : capability.settingsHint,
    showWorkspaceNotice,
  };
};
