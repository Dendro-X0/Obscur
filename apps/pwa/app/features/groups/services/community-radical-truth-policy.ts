/**
 * Radical membership truth — underground / pre-v1.9.1 default.
 *
 * When enforced:
 * - Persisted chat-state alone never materializes as a joined community in the sidebar.
 * - Coordinator does not backfill ledger from persisted_fallback (no synthetic joined rows).
 *
 * Joined communities require ledger evidence (create/accept/leave flows write ledger).
 * Opt out: NEXT_PUBLIC_OBSCUR_RADICAL_TRUTH=0
 *
 * Mobile and desktop product shells opt out — local chat-state is durable UX truth on device.
 */

import { isDesktopShellBuild, isMobileShellBuild } from "@/app/features/runtime/shell-contract";
import { isRelayAuthoritativeMembershipEnforced } from "./community-relay-authoritative-membership-policy";

const parseEnvFlag = (raw: string | undefined): boolean | null => {
  const normalized = (raw ?? "").trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on") {
    return true;
  }
  if (normalized === "0" || normalized === "false" || normalized === "no" || normalized === "off") {
    return false;
  }
  return null;
};

/** Default ON in non-production builds unless explicitly disabled. Relay-authoritative mode always ON. */
export const isRadicalMembershipTruthEnforced = (): boolean => {
  if (isRelayAuthoritativeMembershipEnforced()) {
    return true;
  }
  if (isMobileShellBuild() || isDesktopShellBuild()) {
    return false;
  }
  const explicit = parseEnvFlag(process.env.NEXT_PUBLIC_OBSCUR_RADICAL_TRUTH);
  if (explicit !== null) {
    return explicit;
  }
  if (process.env.NODE_ENV === "production") {
    return false;
  }
  return true;
};
