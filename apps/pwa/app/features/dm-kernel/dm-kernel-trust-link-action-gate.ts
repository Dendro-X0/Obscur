import {
  isLookalikeBrandUrl,
  isSuspiciousUrlShape,
} from "./dm-kernel-trust-link-signals";
import type { TrustActionFrictionLevel } from "./dm-kernel-trust-assessment-port";

/** M4 link-open friction — structural URL classes only (no duplicate regex). */
export const resolveLinkOpenFriction = (rawUrl: string): TrustActionFrictionLevel => {
  if (isLookalikeBrandUrl(rawUrl) || isSuspiciousUrlShape(rawUrl)) {
    return "confirm";
  }
  return "none";
};

export const requiresLinkConfirmBeforeOpen = (rawUrl: string): boolean => (
  resolveLinkOpenFriction(rawUrl) === "confirm"
);
