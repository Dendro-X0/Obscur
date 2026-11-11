import { OBSCUR_NOSTR_DISPLAY_NAME } from "./module-display-names";
import type { ProtocolId } from "./types";

/** Cut 2.3 — giftwrap connection-request wire stays on Obscur-Nostr; not Soft L3 Fixed. */
export const PRIVATE_DC_INVITE_REQUIRES_OBSCUR_NOSTR = "private_dc_invite_requires_obscur_nostr";
export const MATRIX_INVITE_REQUIRES_OBSCUR_NOSTR = "matrix_invite_requires_obscur_nostr";

export type ConnectionRequestInvitePolicy = Readonly<{
  allowed: boolean;
  reasonCode?: string;
  /** User-facing honesty — safe for toast / dialog banner. */
  userMessage: string;
}>;

/**
 * Giftwrap connection requests are Obscur-Nostr module wire.
 * Private DC / Matrix: refuse silently-stranded throws; return honest policy.
 */
export const resolveConnectionRequestInvitePolicy = (
  protocolId: ProtocolId,
): ConnectionRequestInvitePolicy => {
  if (protocolId === "private_dc") {
    return {
      allowed: false,
      reasonCode: PRIVATE_DC_INVITE_REQUIRES_OBSCUR_NOSTR,
      userMessage:
        `Connection invites use the ${OBSCUR_NOSTR_DISPLAY_NAME} module. `
        + "Switch protocol to Obscur-Nostr in Settings → Protocols, or add trust locally after an out-of-band exchange. "
        + "Private DC send stays T3/H-dc — this is not Soft L3 contact Pass.",
    };
  }
  if (protocolId === "matrix") {
    return {
      allowed: false,
      reasonCode: MATRIX_INVITE_REQUIRES_OBSCUR_NOSTR,
      userMessage:
        `Connection invites use the ${OBSCUR_NOSTR_DISPLAY_NAME} module. `
        + "Matrix (lab) uses rooms on your homeserver — switch to Obscur-Nostr for giftwrap invites.",
    };
  }
  return {
    allowed: true,
    userMessage: "",
  };
};
