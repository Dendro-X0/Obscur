/**
 * W65 gate-closed existence pin migration — contracts that flip after production subtraction.
 * Maintainer-only; no runtime side effects while sign-off is BLOCKED.
 */

export const STANDALONE_LEGACY_GATE_CLOSED_EXISTENCE_PIN_CONTRACTS = [
  "app/engine-lab/transport-engine-w55.contract.test.ts",
  "app/engine-lab/transport-engine-w56.contract.test.ts",
  "app/engine-lab/transport-engine-w57.contract.test.ts",
  "app/engine-lab/transport-engine-w58.contract.test.ts",
  "app/engine-lab/transport-engine-w59.contract.test.ts",
  "app/engine-lab/transport-engine-w60.contract.test.ts",
  "app/engine-lab/transport-engine-w61.contract.test.ts",
  "app/engine-lab/transport-engine-w62.contract.test.ts",
  "app/engine-lab/transport-engine-w63.contract.test.ts",
  "app/engine-lab/transport-engine-w64.contract.test.ts",
] as const;

/** Substrings that identify gate-closed existence assertions in pin contracts. */
export const STANDALONE_LEGACY_GATE_CLOSED_PIN_MARKERS = [
  "STANDALONE_LEGACY_FILES_TO_DELETE",
  "transport-kernel-standalone-publish-legacy",
  "on disk while gate is closed",
  "keeps legacy",
  "keeps production legacy",
] as const;

/** Post-subtraction replacements documented for maintainer pin flip (W66+). */
export const STANDALONE_LEGACY_POST_SUBTRACTION_PIN_MARKERS = [
  "evaluateStandaloneLegacyPostSubtractionBaseline",
  "postSubtractionComplete",
  "resolveStandaloneLegacyContractReadPath(false)",
  "STANDALONE_LEGACY_ARCHIVE_PATH",
] as const;
