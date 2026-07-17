import type { MeshTorRuntimeState } from "@obscur/conduit-mesh-contracts";

import type { TransportPreset } from "./transport-preset-catalog";

export type RelayRow = Readonly<{ url: string; enabled: boolean }>;

/** Confirm before replacing a non-empty endpoint list. */
export const shouldConfirmPresetReplace = (
  relays: ReadonlyArray<RelayRow>,
): boolean => relays.length > 0;

/** Tor-required packs cannot apply until the host reports Tor ready (C3 fail-closed). */
export const isTorPresetApplyBlocked = (
  preset: TransportPreset,
  torState: MeshTorRuntimeState,
): boolean => Boolean(preset.requiresTor && !torState.ready);

/** First placeholder URL for template packs (LAN / onion). */
export const resolveTemplatePrefillUrl = (
  preset: TransportPreset,
): string | undefined => (
  preset.isUrlTemplate && preset.relays.length > 0 ? preset.relays[0] : undefined
);
