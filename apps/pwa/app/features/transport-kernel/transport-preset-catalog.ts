/**
 * Canonical transport preset catalog (v1.9.14).
 * Presets configure which endpoints carry ciphertext — encryption stays on the client.
 */
import { LOCAL_DEV_WORKSPACE_RELAY_URL } from "@/app/features/relays/services/relay-transport-scope";

export type TransportPresetId =
  | "default_stable"
  | "high_redundancy"
  | "low_latency"
  | "local_dev_mesh"
  | "local_http_mesh"
  | "private_lan_ws"
  | "hybrid_public_http"
  | "tor_onion_mesh";

export type TransportPresetCategory =
  | "public_nostr"
  | "private_mesh"
  | "hybrid_adapters"
  | "tor";

export type RelayTransportMode = "basic" | "redundancy";

export type TransportPreset = Readonly<{
  id: TransportPresetId;
  category: TransportPresetCategory;
  /** i18n key for button label */
  labelKey: string;
  /** i18n key for description (toast / help) */
  descriptionKey: string;
  relays: ReadonlyArray<string>;
  transportMode: RelayTransportMode;
  /** Show Tor-required hint in Settings when applying this pack. */
  requiresTor?: boolean;
  /** User must replace placeholder URLs (LAN IP, .onion host) before relying on delivery. */
  isUrlTemplate?: boolean;
}>;

export type TransportPresetGroup = Readonly<{
  category: TransportPresetCategory;
  titleKey: string;
  descriptionKey: string;
  presetIds: ReadonlyArray<TransportPresetId>;
}>;

export const DEFAULT_STABLE_PRESET: TransportPreset = {
  id: "default_stable",
  category: "public_nostr",
  labelKey: "settings.relays.preset.defaultStable",
  descriptionKey: "settings.relays.preset.defaultStableDesc",
  relays: ["wss://relay.damus.io", "wss://nos.lol", "wss://relay.primal.net"],
  transportMode: "basic",
};

const HIGH_REDUNDANCY_PRESET: TransportPreset = {
  id: "high_redundancy",
  category: "public_nostr",
  labelKey: "settings.relays.preset.highRedundancy",
  descriptionKey: "settings.relays.preset.highRedundancyDesc",
  relays: [
    "wss://relay.damus.io",
    "wss://nos.lol",
    "wss://relay.primal.net",
    "wss://relay.snort.social",
    "wss://relay.nostr.band",
  ],
  transportMode: "redundancy",
};

const LOW_LATENCY_PRESET: TransportPreset = {
  id: "low_latency",
  category: "public_nostr",
  labelKey: "settings.relays.preset.lowLatency",
  descriptionKey: "settings.relays.preset.lowLatencyDesc",
  relays: ["wss://relay.primal.net", "wss://relay.damus.io", "wss://nos.lol"],
  transportMode: "basic",
};

/** Local dev stack — requires `pnpm dev:relay` or Docker relay on :7000 */
export const LOCAL_DEV_MESH_PRESET: TransportPreset = {
  id: "local_dev_mesh",
  category: "private_mesh",
  labelKey: "settings.relays.preset.localDevMesh",
  descriptionKey: "settings.relays.preset.localDevMeshDesc",
  relays: [LOCAL_DEV_WORKSPACE_RELAY_URL],
  transportMode: "basic",
};

/** Loopback HTTP mesh gateway — Conduit Mesh team_relay dialect (not Nostr wire). */
export const LOCAL_HTTP_MESH_PRESET: TransportPreset = {
  id: "local_http_mesh",
  category: "private_mesh",
  labelKey: "settings.relays.preset.localHttpMesh",
  descriptionKey: "settings.relays.preset.localHttpMeshDesc",
  relays: ["http://127.0.0.1:8788"],
  transportMode: "basic",
};

/** RFC1918 LAN relay template — user replaces the IP with their private node. */
export const PRIVATE_LAN_WS_PRESET: TransportPreset = {
  id: "private_lan_ws",
  category: "private_mesh",
  labelKey: "settings.relays.preset.privateLanWs",
  descriptionKey: "settings.relays.preset.privateLanWsDesc",
  relays: ["ws://192.168.0.100:7000"],
  transportMode: "basic",
  isUrlTemplate: true,
};

/** Mixed adapters — public Nostr WS + private HTTP mesh on one profile. */
export const HYBRID_PUBLIC_HTTP_PRESET: TransportPreset = {
  id: "hybrid_public_http",
  category: "hybrid_adapters",
  labelKey: "settings.relays.preset.hybridPublicHttp",
  descriptionKey: "settings.relays.preset.hybridPublicHttpDesc",
  relays: ["wss://relay.damus.io", "http://127.0.0.1:8788"],
  transportMode: "redundancy",
};

/** Tor-required onion gateway template — replace host after enabling Tor. */
export const TOR_ONION_MESH_PRESET: TransportPreset = {
  id: "tor_onion_mesh",
  category: "tor",
  labelKey: "settings.relays.preset.torOnionMesh",
  descriptionKey: "settings.relays.preset.torOnionMeshDesc",
  relays: ["http://example.onion/mesh"],
  transportMode: "basic",
  requiresTor: true,
  isUrlTemplate: true,
};

export const TRANSPORT_PRESET_CATALOG: ReadonlyArray<TransportPreset> = [
  DEFAULT_STABLE_PRESET,
  HIGH_REDUNDANCY_PRESET,
  LOW_LATENCY_PRESET,
  LOCAL_DEV_MESH_PRESET,
  LOCAL_HTTP_MESH_PRESET,
  PRIVATE_LAN_WS_PRESET,
  HYBRID_PUBLIC_HTTP_PRESET,
  TOR_ONION_MESH_PRESET,
];

export const TRANSPORT_PRESET_GROUPS: ReadonlyArray<TransportPresetGroup> = [
  {
    category: "public_nostr",
    titleKey: "settings.relays.presetGroup.publicNostr",
    descriptionKey: "settings.relays.presetGroup.publicNostrDesc",
    presetIds: ["default_stable", "high_redundancy", "low_latency"],
  },
  {
    category: "private_mesh",
    titleKey: "settings.relays.presetGroup.privateMesh",
    descriptionKey: "settings.relays.presetGroup.privateMeshDesc",
    presetIds: ["local_dev_mesh", "local_http_mesh", "private_lan_ws"],
  },
  {
    category: "hybrid_adapters",
    titleKey: "settings.relays.presetGroup.hybridAdapters",
    descriptionKey: "settings.relays.presetGroup.hybridAdaptersDesc",
    presetIds: ["hybrid_public_http"],
  },
  {
    category: "tor",
    titleKey: "settings.relays.presetGroup.tor",
    descriptionKey: "settings.relays.presetGroup.torDesc",
    presetIds: ["tor_onion_mesh"],
  },
];

/** @deprecated Use TRANSPORT_PRESET_CATALOG — kept for settings re-exports */
export const RELAY_PRESETS = TRANSPORT_PRESET_CATALOG;

export type RelayPresetId = TransportPresetId;

export const getTransportPreset = (id: TransportPresetId): TransportPreset | undefined => (
  TRANSPORT_PRESET_CATALOG.find((preset) => preset.id === id)
);

export const getTransportPresetsForGroup = (
  group: TransportPresetGroup,
): ReadonlyArray<TransportPreset> => (
  group.presetIds
    .map((id) => getTransportPreset(id))
    .filter((preset): preset is TransportPreset => preset !== undefined)
);

export const buildRelayRowsFromPreset = (
  preset: TransportPreset,
): ReadonlyArray<{ url: string; enabled: boolean }> => (
  preset.relays.map((url) => ({ url, enabled: true }))
);
