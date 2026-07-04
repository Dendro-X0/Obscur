import {
  STANDALONE_LEGACY_ARCHIVE_PATH,
  STANDALONE_LEGACY_FILES_TO_DELETE,
} from "./transport-kernel-standalone-deletion-subtraction-manifest";

/** Resolves engine-lab contract read path: production legacy while present, archive after deletion. */
export const resolveStandaloneLegacyContractReadPath = (
  legacyProductionExists: boolean,
): string => (
  legacyProductionExists
    ? STANDALONE_LEGACY_FILES_TO_DELETE[0]!
    : STANDALONE_LEGACY_ARCHIVE_PATH
);

/** Token used in port source to detect legacy import before/after subtraction. */
export const STANDALONE_LEGACY_PORT_IMPORT_TOKEN = "transport-kernel-standalone-publish-legacy";
