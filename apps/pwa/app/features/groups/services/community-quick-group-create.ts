/**
 * Quick group (T0) create — public Quiet / any writable wss host without coordination.
 * Team workspace (T1) still uses assessWorkspaceCommunityTrust.
 */

import type { CommunityHostingTier, CommunityMode } from "../types";
import {
  assessRelayCapability,
  isPublicDefaultRelayHost,
  normalizeRelayHost,
  type RelayCapabilityAssessment,
} from "./community-mode-contract";
import { hasWritableCommunityRelayTransport } from "./community-relay-transport";
import { normalizeWorkspaceRelayUrl } from "./workspace-relay-url";

export type QuickGroupCreateReasonCode =
  | "allowed"
  | "relay_unconfigured"
  | "relay_not_writable";

export type QuickGroupCreateAssessment = Readonly<{
  allowed: boolean;
  reasonCode: QuickGroupCreateReasonCode;
  userMessage: string;
  settingsHint: string;
  relayAssessment: RelayCapabilityAssessment;
  /** Host is a known Quiet / public default — show honesty copy. */
  isPublicQuietHost: boolean;
}>;

export const assessQuickGroupCreate = (params: Readonly<{
  communityRelayUrl: string;
  enabledRelayUrls?: ReadonlyArray<string>;
}>): QuickGroupCreateAssessment => {
  const relayUrl = normalizeWorkspaceRelayUrl(params.communityRelayUrl);
  const host = normalizeRelayHost(relayUrl);
  const relayAssessment = assessRelayCapability({
    enabledRelayUrls: params.enabledRelayUrls ?? [],
    selectedRelayHost: host,
  });
  const isPublicQuietHost = relayAssessment.tier === "public_default"
    || isPublicDefaultRelayHost(host ?? "");

  if (!relayUrl || relayAssessment.tier === "unconfigured") {
    return {
      allowed: false,
      reasonCode: "relay_unconfigured",
      userMessage: "Choose a relay host from Settings → Relays (any enabled wss:// works for a quick group).",
      settingsHint: "Enable a Quiet public relay or add your own wss:// URL, then create again.",
      relayAssessment,
      isPublicQuietHost: false,
    };
  }

  if (!hasWritableCommunityRelayTransport(relayUrl)) {
    return {
      allowed: false,
      reasonCode: "relay_not_writable",
      userMessage: "That host is not a writable Nostr relay URL.",
      settingsHint: "Use wss://… (or ws://localhost:port for local Docker).",
      relayAssessment,
      isPublicQuietHost,
    };
  }

  return {
    allowed: true,
    reasonCode: "allowed",
    userMessage: "",
    settingsHint: isPublicQuietHost
      ? "Quick groups on public relays: encrypted chat works; full delete-for-all and enterprise directory need a team-hosted relay."
      : "Quick group on your chosen relay — team workspace mode adds coordination directory when configured.",
    relayAssessment,
    isPublicQuietHost,
  };
};

/** Map create tier + Quiet detection to persisted hosting honesty (CU-UX-2b / CU-UX-5). */
export const resolveHostingTierForCreate = (params: Readonly<{
  communityMode: CommunityMode;
  isPublicQuietHost: boolean;
}>): CommunityHostingTier => {
  if (params.isPublicQuietHost) {
    return "public_quiet";
  }
  if (params.communityMode === "managed_workspace") {
    return "operator";
  }
  return "custom";
};

/** Prefer an enabled Quiet public host; else first enabled writable non-empty URL. */
export const pickDefaultQuickGroupRelayHost = (
  relays: ReadonlyArray<{ url: string; enabled: boolean }>,
): string => {
  const enabled = relays.filter((relay) => relay.enabled);
  const publicHit = enabled.find((relay) => {
    const host = normalizeRelayHost(relay.url);
    return host && isPublicDefaultRelayHost(host) && hasWritableCommunityRelayTransport(relay.url);
  });
  if (publicHit) {
    return normalizeRelayHost(publicHit.url) ?? hostFromUrl(publicHit.url);
  }
  const anyWritable = enabled.find((relay) => hasWritableCommunityRelayTransport(relay.url));
  if (anyWritable) {
    return normalizeRelayHost(anyWritable.url) ?? hostFromUrl(anyWritable.url);
  }
  return "";
};

const hostFromUrl = (url: string): string => (
  url.replace(/^wss?:\/\//i, "").replace(/\/$/, "")
);
