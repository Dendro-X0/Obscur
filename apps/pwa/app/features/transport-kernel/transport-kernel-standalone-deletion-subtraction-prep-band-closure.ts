/**
 * W68 prep band closure — aggregates w55–w67 readiness; no runtime side effects.
 */

export const STANDALONE_LEGACY_SUBTRACTION_PREP_BAND_CHARTER = (
  "docs/program/transport-engine-w68-standalone-legacy-subtraction-prep-band-closure.md"
);

export const STANDALONE_LEGACY_SUBTRACTION_PREP_VERIFY_SCRIPT = (
  "scripts/verify-standalone-legacy-subtraction-prep.mjs"
);

/** Maintainer execution remains gated; prep waves w55–w67 are complete. */
export const STANDALONE_LEGACY_SUBTRACTION_PREP_BAND_WAVES = [
  "w55", "w56", "w57", "w58", "w59", "w60", "w61", "w62", "w63", "w64", "w65", "w66", "w67",
] as const;
