/**
 * W58 subtraction manifest — pins files to delete and update when the W56 gate opens.
 * Maintainer-only; no runtime deletion side effects.
 */

export const STANDALONE_LEGACY_FILES_TO_DELETE = [
  "app/features/transport-kernel/transport-kernel-standalone-publish-legacy.ts",
  "app/features/transport-kernel/transport-kernel-standalone-publish.ts",
] as const;

/** W60 frozen archive for historical engine-lab contract pins after production deletion. */
export const STANDALONE_LEGACY_ARCHIVE_PATH = (
  "app/engine-lab/fixtures/transport-kernel-standalone-publish-legacy.archive.ts"
);

export const STANDALONE_LEGACY_PORT_PATHS_TO_UPDATE = [
  "app/features/relays/hooks/relay-standalone-publish-port.ts",
] as const;

/** W62 post-subtraction port routing (host + blocked only). */
export const STANDALONE_LEGACY_SUBTRACTED_PORT_PATH = (
  "app/features/relays/hooks/relay-standalone-publish-port-subtracted.ts"
);

/** W64 frozen thin port body copied into production port after legacy deletion. */
export const STANDALONE_LEGACY_THIN_PORT_PATH = (
  "app/features/relays/hooks/relay-standalone-publish-port-thin.ts"
);

/** Unit tests that import or mock the legacy standalone owner. */
export const STANDALONE_LEGACY_UNIT_TESTS_TO_MIGRATE = [
  "app/features/transport-kernel/transport-kernel-standalone-publish.test.ts",
  "app/features/relays/hooks/relay-standalone-publish-port.test.ts",
  "app/features/relays/hooks/relay-standalone-publish-port-subtracted.test.ts",
] as const;

/** Engine-lab contract pins that read or mock `-legacy.ts`. */
export const STANDALONE_LEGACY_ENGINE_LAB_CONTRACTS_TO_MIGRATE = [
  "app/engine-lab/transport-engine-w14.contract.test.ts",
  "app/engine-lab/transport-engine-w15.contract.test.ts",
  "app/engine-lab/transport-engine-w19.contract.test.ts",
  "app/engine-lab/transport-engine-w23.contract.test.ts",
  "app/engine-lab/transport-engine-w35.harness.contract.test.ts",
  "app/engine-lab/transport-engine-w39.harness.contract.test.ts",
  "app/engine-lab/transport-engine-w40.contract.test.ts",
  "app/engine-lab/transport-engine-w47.contract.test.ts",
  "app/engine-lab/transport-engine-w47.harness.contract.test.ts",
  "app/engine-lab/transport-engine-w50.harness.contract.test.ts",
  "app/engine-lab/transport-engine-w52.contract.test.ts",
  "app/engine-lab/transport-engine-w53.harness.contract.test.ts",
  "app/engine-lab/transport-engine-w54.contract.test.ts",
  "app/engine-lab/transport-engine-w55.contract.test.ts",
  "app/engine-lab/transport-engine-w55.harness.contract.test.ts",
  "app/engine-lab/transport-engine-w56.contract.test.ts",
  "app/engine-lab/transport-engine-w56.harness.contract.test.ts",
  "app/engine-lab/transport-engine-w57.contract.test.ts",
  "app/engine-lab/transport-engine-w57.harness.contract.test.ts",
  "app/engine-lab/transport-engine-w58.contract.test.ts",
  "app/engine-lab/transport-engine-w58.harness.contract.test.ts",
  "app/engine-lab/transport-engine-w59.contract.test.ts",
  "app/engine-lab/transport-engine-w59.harness.contract.test.ts",
  "app/engine-lab/transport-engine-w60.contract.test.ts",
  "app/engine-lab/transport-engine-w60.harness.contract.test.ts",
  "app/engine-lab/transport-engine-w61.contract.test.ts",
  "app/engine-lab/transport-engine-w61.harness.contract.test.ts",
  "app/engine-lab/transport-engine-w62.contract.test.ts",
  "app/engine-lab/transport-engine-w62.harness.contract.test.ts",
  "app/engine-lab/transport-engine-w63.contract.test.ts",
  "app/engine-lab/transport-engine-w63.harness.contract.test.ts",
  "app/engine-lab/transport-engine-w64.contract.test.ts",
  "app/engine-lab/transport-engine-w64.harness.contract.test.ts",
  "app/engine-lab/transport-engine-w65.contract.test.ts",
  "app/engine-lab/transport-engine-w65.harness.contract.test.ts",
  "app/engine-lab/transport-engine-w66.contract.test.ts",
  "app/engine-lab/transport-engine-w66.harness.contract.test.ts",
  "app/engine-lab/transport-engine-w67.contract.test.ts",
  "app/engine-lab/transport-engine-w67.harness.contract.test.ts",
  "app/engine-lab/transport-engine-w68.contract.test.ts",
  "app/engine-lab/transport-engine-w68.harness.contract.test.ts",
  "app/engine-lab/transport-engine-standalone-legacy-contract-read.ts",
  "app/features/relays/hooks/relay-standalone-publish-port-subtracted.ts",
  "app/features/relays/hooks/relay-standalone-publish-port-subtracted.test.ts",
] as const;

/** Quorum semantics owner — must remain after standalone deletion. */
export const STANDALONE_LEGACY_SEMANTICS_OWNER_PRESERVED = (
  "app/features/relays/lib/publish-outcome-mapper.ts"
);

export const STANDALONE_LEGACY_POST_DELETION_PORT_OWNERS = [
  "app/features/transport-kernel/transport-kernel-standalone-publish-blocked.ts",
  "app/features/transport-kernel/transport-kernel-host-publish-shim.ts",
] as const;

export const STANDALONE_LEGACY_DELETION_RECORDED_SIGN_OFF = (
  "docs/handoffs/transport-engine-smoke-sign-off-recorded.md"
);

export const STANDALONE_LEGACY_DELETION_APPROVAL_ENV = (
  "NEXT_PUBLIC_OBSCUR_TRANSPORT_STANDALONE_LEGACY_DELETION_APPROVED"
);
