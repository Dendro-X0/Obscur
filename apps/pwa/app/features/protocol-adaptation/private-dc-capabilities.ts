/**
 * P4h — Private DC advertised capabilities.
 * @see specs/backend/platform-p4h-private-dc-capabilities-rich-map-2026-11.md
 */

import type { ProtocolCapabilities } from "./types";

/** Company / private-server carrier surface (v0 wire — DMs only). */
export const PRIVATE_DC_CAPABILITIES: ProtocolCapabilities = {
  dms: true,
  groups: false,
  reactions: false,
  media: false,
};
