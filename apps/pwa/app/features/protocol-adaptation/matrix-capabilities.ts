/**
 * C3 — Matrix lab advertised capabilities (not promote).
 * @see specs/backend/platform-c3-matrix-capabilities-rich-map-2026-11.md
 */

import type { ProtocolCapabilities } from "./types";

/** Lab HS REST surface — rooms as DMs/groups; no reactions/media in this slice. */
export const MATRIX_LAB_CAPABILITIES: ProtocolCapabilities = {
  dms: true,
  groups: true,
  reactions: false,
  media: false,
};
