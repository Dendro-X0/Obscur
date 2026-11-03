/**
 * Platform rewrite band **P2** (L1 fence) — daily Auth door.
 * Passphrase / device password is primary; private key is Advanced / recovery only.
 * L3 desktop soak still required before claiming Auth plane freeze Fixed.
 *
 * @see specs/backend/platform-rewrite-band-charter-2026-11.md (P2)
 */

/** Shell must expose private-key unlock behind Advanced, not as the primary door. */
export const AUTH_DAILY_DOOR_PRIMARY = "passphrase_or_device_password" as const;

export const AUTH_DAILY_DOOR_ADVANCED = "private_key_import_or_unlock" as const;

export const AUTH_DAILY_DOOR_RULES = [
  "passphrase_primary_when_device_password_row_exists",
  "private_key_ui_behind_advanced_toggle",
  "no_oauth_as_root_identity",
  "l3_desktop_soak_before_auth_plane_freeze_claim",
] as const;

export type AuthDailyDoorRule = (typeof AUTH_DAILY_DOOR_RULES)[number];
