import type { RelayTransportMode, TransportPreset, TransportPresetId } from "./transport-preset-catalog";
import { TRANSPORT_PRESET_CATALOG } from "./transport-preset-catalog";

export type TransportPresetMatchState = "active" | "partial" | "available";

export type RelayListRow = Readonly<{
  url: string;
  enabled: boolean;
}>;

export type ActiveTransportMix = Readonly<{
  publicNostr: number;
  privateMesh: number;
  tor: number;
  totalEnabled: number;
  redundancyMode: boolean;
}>;

const normalizeRelayUrl = (url: string): string => url.trim();

export const getEnabledRelayUrls = (
  relays: ReadonlyArray<RelayListRow>,
): ReadonlyArray<string> => (
  relays.filter((relay) => relay.enabled).map((relay) => normalizeRelayUrl(relay.url))
);

export const matchTransportPreset = (
  relays: ReadonlyArray<RelayListRow>,
  transportMode: RelayTransportMode,
  preset: TransportPreset,
): TransportPresetMatchState => {
  const enabledUrls = getEnabledRelayUrls(relays);
  const enabledSet = new Set(enabledUrls);
  const presetUrls = preset.relays.map(normalizeRelayUrl);
  const presetSet = new Set(presetUrls);

  if (presetSet.size === 0) {
    return "available";
  }

  let overlap = 0;
  for (const url of presetSet) {
    if (enabledSet.has(url)) {
      overlap += 1;
    }
  }

  if (overlap === 0) {
    return "available";
  }

  const setsEqual = enabledSet.size === presetSet.size && overlap === presetSet.size;
  const modeMatches = transportMode === preset.transportMode;

  if (setsEqual && modeMatches) {
    return "active";
  }

  return "partial";
};

export const resolveTransportPresetMatches = (
  relays: ReadonlyArray<RelayListRow>,
  transportMode: RelayTransportMode,
): Readonly<Record<TransportPresetId, TransportPresetMatchState>> => {
  const matches = {} as Record<TransportPresetId, TransportPresetMatchState>;
  for (const preset of TRANSPORT_PRESET_CATALOG) {
    matches[preset.id] = matchTransportPreset(relays, transportMode, preset);
  }
  return matches;
};

export const resolveActiveTransportPresetId = (
  matches: Readonly<Record<TransportPresetId, TransportPresetMatchState>>,
): TransportPresetId | undefined => (
  TRANSPORT_PRESET_CATALOG.find((preset) => matches[preset.id] === "active")?.id
);

export const resolveActiveTransportMix = (
  relays: ReadonlyArray<RelayListRow>,
  transportMode: RelayTransportMode,
  classifyAdapter: (url: string) => "nostr_public" | "private_ws" | "http_mesh" | "tor_mesh",
): ActiveTransportMix => {
  const counts = {
    publicNostr: 0,
    privateMesh: 0,
    tor: 0,
  };

  for (const relay of relays) {
    if (!relay.enabled) {
      continue;
    }
    const kind = classifyAdapter(relay.url);
    if (kind === "nostr_public") {
      counts.publicNostr += 1;
    } else if (kind === "tor_mesh") {
      counts.tor += 1;
    } else {
      counts.privateMesh += 1;
    }
  }

  return {
    ...counts,
    totalEnabled: relays.filter((relay) => relay.enabled).length,
    redundancyMode: transportMode === "redundancy",
  };
};
