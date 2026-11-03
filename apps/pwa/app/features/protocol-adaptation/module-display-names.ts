/**
 * P5 — human-facing protocol / module names (wire ids stay lowercase).
 * @see specs/backend/platform-p5-naming-design-2026-11.md
 */

import {
  OBSCUR_NOSTR_DISPLAY_NAME,
  OBSCUR_NOSTR_PACKAGE_NAME,
  OBSCUR_NOSTR_PROTOCOL_ID,
} from "@obscur/protocol-nostr";
import type { ProtocolId } from "./types";

/** Public product / shell name — never a protocol brand. */
export const OBSCUR_PLATFORM_DISPLAY_NAME = "Obscur" as const;

export const MATRIX_LAB_DISPLAY_NAME = "Matrix (lab)" as const;

export const PRIVATE_DC_DISPLAY_NAME = "Private DC" as const;

export {
  OBSCUR_NOSTR_DISPLAY_NAME,
  OBSCUR_NOSTR_PACKAGE_NAME,
  OBSCUR_NOSTR_PROTOCOL_ID,
};

const PROTOCOL_DISPLAY_NAME: Record<ProtocolId, string> = {
  nostr: OBSCUR_NOSTR_DISPLAY_NAME,
  matrix: MATRIX_LAB_DISPLAY_NAME,
  private_dc: PRIVATE_DC_DISPLAY_NAME,
};

/** Settings / shell label for a wire protocol id. */
export const protocolDisplayName = (protocolId: ProtocolId): string => (
  PROTOCOL_DISPLAY_NAME[protocolId]
);
