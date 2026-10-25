import type { MeshTorRuntimeState } from "@obscur/conduit-mesh-contracts/tor-policy";

import type { TransportPreset } from "./transport-preset-catalog";

export type RelayRow = Readonly<{ url: string; enabled: boolean }>;

export type TorPresetBadgeKind = "off" | "not_ready" | "ready";

/** Confirm before applying a Tor-required pack (never silent / never auto-start Tor). */
export const shouldConfirmTorPresetApply = (
  preset: TransportPreset,
): boolean => Boolean(preset.requiresTor);

/** Confirm before replacing a non-empty endpoint list. */
export const shouldConfirmPresetReplace = (
  relays: ReadonlyArray<RelayRow>,
): boolean => relays.length > 0;

/**
 * Whether Apply should open the confirm dialog before mutating the relay list.
 * Tor packs always confirm; other packs confirm when replacing an existing list.
 */
export const shouldConfirmTransportPresetApply = (
  preset: TransportPreset,
  relays: ReadonlyArray<RelayRow>,
): boolean => (
  shouldConfirmTorPresetApply(preset) || shouldConfirmPresetReplace(relays)
);

/** Tor-required packs cannot apply until the host reports Tor ready (C3 fail-closed). */
export const isTorPresetApplyBlocked = (
  preset: TransportPreset,
  torState: MeshTorRuntimeState,
): boolean => Boolean(preset.requiresTor && !torState.ready);

/**
 * Honest Tor pack badge: "off" when Tor is disabled (default),
 * "not_ready" only while opted-in and still bootstrapping.
 */
export const resolveTorPresetBadgeKind = (
  preset: TransportPreset,
  torState: MeshTorRuntimeState,
): TorPresetBadgeKind | null => {
  if (!preset.requiresTor) {
    return null;
  }
  if (torState.ready) {
    return "ready";
  }
  if (!torState.configured) {
    return "off";
  }
  return "not_ready";
};

/** First placeholder URL for template packs (LAN / onion). */
export const resolveTemplatePrefillUrl = (
  preset: TransportPreset,
): string | undefined => (
  preset.isUrlTemplate && preset.relays.length > 0 ? preset.relays[0] : undefined
);
