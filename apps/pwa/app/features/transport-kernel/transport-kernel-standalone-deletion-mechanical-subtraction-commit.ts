/**
 * W66 mechanical subtraction commit — ordered maintainer steps when gate opens.
 * No runtime side effects while sign-off is BLOCKED.
 */

export const STANDALONE_LEGACY_MECHANICAL_SUBTRACTION_COMMIT_STEPS = [
  "execute-transport-standalone-legacy-subtraction.mjs exits 0",
  "Delete STANDALONE_LEGACY_FILES_TO_DELETE",
  "Copy relay-standalone-publish-port-thin.ts into relay-standalone-publish-port.ts",
  "Remove or retarget transport-kernel-standalone-publish.test.ts",
  "Migrate STANDALONE_LEGACY_GATE_CLOSED_EXISTENCE_PIN_CONTRACTS",
  "evaluateStandaloneLegacyPostSubtractionBaseline → postSubtractionComplete",
  "pnpm verify:transport-engine-w67 && pnpm verify:engine-lab",
] as const;

export const STANDALONE_LEGACY_MECHANICAL_SUBTRACTION_SCRIPT = (
  "scripts/execute-transport-standalone-legacy-subtraction.mjs"
);

export const STANDALONE_LEGACY_MECHANICAL_SUBTRACTION_CHARTER = (
  "docs/program/transport-engine-w66-standalone-legacy-mechanical-subtraction-commit.md"
);
