/**
 * W67 B5 exit verification — criteria for standalone legacy subtraction band completion.
 * Exit is complete only after W66 mechanical commit and postSubtractionComplete.
 */

export const STANDALONE_LEGACY_B5_EXIT_CRITERIA = [
  "STANDALONE_LEGACY_FILES_TO_DELETE absent from disk",
  "relay-standalone-publish-port omits transport-kernel-standalone-publish-legacy",
  "STANDALONE_LEGACY_ARCHIVE_PATH present on disk",
  "STANDALONE_LEGACY_SEMANTICS_OWNER_PRESERVED present on disk",
  "evaluateStandaloneLegacyPostSubtractionBaseline → postSubtractionComplete",
  "pnpm verify:transport-engine-w67 && pnpm verify:engine-lab",
] as const;

export const STANDALONE_LEGACY_B5_EXIT_CHARTER = (
  "docs/program/transport-engine-w67-standalone-legacy-b5-exit-verification.md"
);

export const STANDALONE_LEGACY_B5_EXIT_POST_DELETION_OWNERS = [
  "app/features/transport-kernel/transport-kernel-standalone-publish-blocked.ts",
  "app/features/transport-kernel/transport-kernel-host-publish-shim.ts",
  "app/features/relays/hooks/relay-standalone-publish-port-subtracted.ts",
] as const;
