/**
 * Relay-authoritative community membership (COM-Relay).
 *
 * When enforced, terminal membership mutations (join / leave / create) are not
 * written to local ledger, tombstone, or leave-outbox until relay publish succeeds.
 *
 * Default ON when `NEXT_PUBLIC_OBSCUR_EXPERIMENT_ONLINE=1` (`pnpm dev:desktop:online`).
 * Opt out: `NEXT_PUBLIC_OBSCUR_RELAY_AUTHORITATIVE_MEMBERSHIP=0`
 */

import { isExperimentOnlineEnabled } from "@/app/features/runtime/experiment-shell-policy";

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

export const isRelayAuthoritativeMembershipEnforced = (): boolean => {
  const explicit = parseEnvFlag(process.env.NEXT_PUBLIC_OBSCUR_RELAY_AUTHORITATIVE_MEMBERSHIP);
  if (explicit !== null) {
    return explicit;
  }
  return isExperimentOnlineEnabled();
};

export const relayMembershipRequiresRelayConfirmation = (
  relayConfirmed: boolean | undefined,
): boolean => (
  !isRelayAuthoritativeMembershipEnforced() || relayConfirmed === true
);
