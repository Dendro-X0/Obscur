/**
 * Cut 7.2 — F-sync Continuity tier ids (Plane 3).
 * @see specs/backend/cut7-continuity-m1-sealed-file-design-2026-11-10.md
 * @see docs/exploration/feasibility/20-cross-device-profile-sync-e2ee.md
 */

export type ContinuityTierId = "T0" | "T1" | "T2" | "T3" | "T4";

/** F-sync UX promise — never imply unlock alone recreates a wiped PC. */
export type ContinuityRestoreHonesty = "empty" | "restoring" | "partial" | "full";

/** C0 M1 must represent these tiers in every sealed export. */
export const CONTINUITY_C0_REQUIRED_TIERS = Object.freeze([
  "T0",
  "T1",
  "T2",
] as const);

export const CONTINUITY_TIER_LABELS: Readonly<Record<ContinuityTierId, string>> = Object.freeze({
  T0: "Wrapped identity + enroll residue",
  T1: "Relationship graph + blocks/tombstones",
  T2: "Settings / network homes / protocol toggles",
  T3: "Message bodies / indexes (may be partial)",
  T4: "Vault media CAS (lazy / out of band)",
});
