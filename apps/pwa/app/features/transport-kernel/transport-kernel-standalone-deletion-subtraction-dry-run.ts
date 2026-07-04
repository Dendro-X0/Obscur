import { isStandaloneLegacyDeletionApproved } from "./transport-kernel-standalone-deletion-gate";
import {
  STANDALONE_LEGACY_ARCHIVE_PATH,
  STANDALONE_LEGACY_ENGINE_LAB_CONTRACTS_TO_MIGRATE,
  STANDALONE_LEGACY_FILES_TO_DELETE,
  STANDALONE_LEGACY_PORT_PATHS_TO_UPDATE,
  STANDALONE_LEGACY_POST_DELETION_PORT_OWNERS,
  STANDALONE_LEGACY_SEMANTICS_OWNER_PRESERVED,
  STANDALONE_LEGACY_SUBTRACTED_PORT_PATH,
  STANDALONE_LEGACY_THIN_PORT_PATH,
  STANDALONE_LEGACY_UNIT_TESTS_TO_MIGRATE,
} from "./transport-kernel-standalone-deletion-subtraction-manifest";
import { STANDALONE_LEGACY_PORT_IMPORT_TOKEN } from "./transport-kernel-standalone-deletion-contract-pins";
import { evaluateStandaloneLegacyExistencePinMigrationReadiness } from "./transport-kernel-standalone-deletion-existence-pin-migration-readiness";
import { evaluateStandaloneLegacyPostSubtractionBaseline } from "./transport-kernel-standalone-deletion-post-subtraction-baseline";
import { STANDALONE_LEGACY_B5_EXIT_POST_DELETION_OWNERS } from "./transport-kernel-standalone-deletion-b5-exit";

export type StandaloneLegacySubtractionDryRunReport = Readonly<{
  gateApproved: boolean;
  legacyFilesPresent: boolean;
  legacyArchivePresent: boolean;
  portImportsLegacy: boolean;
  subtractedPortPresent: boolean;
  subtractedPortOmitsLegacyImport: boolean;
  thinPortTemplatePresent: boolean;
  thinPortOmitsLegacyImport: boolean;
  postDeletionOwnersPresent: boolean;
  semanticsOwnerPresent: boolean;
  contractPinsPresent: boolean;
  unitTestPinsPresent: boolean;
  existencePinMigrationReady: boolean;
  mechanicalSubtractionCommitReady: boolean;
  b5ExitVerificationReady: boolean;
  prepBandClosureReady: boolean;
  readyForPhysicalDeletion: boolean;
}>;

export type StandaloneLegacySubtractionDryRunFilesystem = Readonly<{
  fileExists: (relativePathFromPwaRoot: string) => boolean;
  readText: (relativePathFromPwaRoot: string) => string;
}>;

const LEGACY_IMPORT_TOKEN = STANDALONE_LEGACY_PORT_IMPORT_TOKEN;

export const evaluateStandaloneLegacySubtractionDryRun = (
  signOffMarkdown: string,
  fs: StandaloneLegacySubtractionDryRunFilesystem,
): StandaloneLegacySubtractionDryRunReport => {
  const gateApproved = isStandaloneLegacyDeletionApproved(signOffMarkdown);
  const legacyFilesPresent = STANDALONE_LEGACY_FILES_TO_DELETE.every((path) => fs.fileExists(path));
  const legacyArchivePresent = fs.fileExists(STANDALONE_LEGACY_ARCHIVE_PATH);

  const portText = fs.readText(STANDALONE_LEGACY_PORT_PATHS_TO_UPDATE[0]!);
  const portImportsLegacy = portText.includes(LEGACY_IMPORT_TOKEN);

  const subtractedPortPresent = fs.fileExists(STANDALONE_LEGACY_SUBTRACTED_PORT_PATH);
  const subtractedPortText = subtractedPortPresent
    ? fs.readText(STANDALONE_LEGACY_SUBTRACTED_PORT_PATH)
    : "";
  const subtractedPortOmitsLegacyImport = subtractedPortPresent
    && !subtractedPortText.includes(LEGACY_IMPORT_TOKEN);

  const thinPortTemplatePresent = fs.fileExists(STANDALONE_LEGACY_THIN_PORT_PATH);
  const thinPortText = thinPortTemplatePresent ? fs.readText(STANDALONE_LEGACY_THIN_PORT_PATH) : "";
  const thinPortOmitsLegacyImport = thinPortTemplatePresent
    && !thinPortText.includes(LEGACY_IMPORT_TOKEN)
    && thinPortText.includes("relay-standalone-publish-port-subtracted");

  const postDeletionOwnersPresent = STANDALONE_LEGACY_POST_DELETION_PORT_OWNERS.every((path) => (
    fs.fileExists(path)
  ));
  const semanticsOwnerPresent = fs.fileExists(STANDALONE_LEGACY_SEMANTICS_OWNER_PRESERVED);

  const contractPinsPresent = STANDALONE_LEGACY_ENGINE_LAB_CONTRACTS_TO_MIGRATE.every((path) => (
    fs.fileExists(path)
  ));
  const unitTestPinsPresent = STANDALONE_LEGACY_UNIT_TESTS_TO_MIGRATE.every((path) => (
    fs.fileExists(path)
  ));

  const existencePinMigrationReady = evaluateStandaloneLegacyExistencePinMigrationReadiness(fs)
    .readyForPinFlipAfterSubtraction;

  const mechanicalSubtractionCommitReady = (
    legacyFilesPresent
    && legacyArchivePresent
    && portImportsLegacy
    && subtractedPortPresent
    && subtractedPortOmitsLegacyImport
    && thinPortTemplatePresent
    && thinPortOmitsLegacyImport
    && existencePinMigrationReady
    && !evaluateStandaloneLegacyPostSubtractionBaseline(fs).postSubtractionComplete
  );

  const b5ExitOwnersPresent = STANDALONE_LEGACY_B5_EXIT_POST_DELETION_OWNERS.every((path) => (
    fs.fileExists(path)
  ));
  const b5ExitVerificationReady = (
    mechanicalSubtractionCommitReady
    && b5ExitOwnersPresent
    && semanticsOwnerPresent
  );

  const prepBandClosureReady = (
    b5ExitVerificationReady
    && fs.fileExists("app/features/transport-kernel/transport-kernel-standalone-deletion-subtraction-prep-band-closure-readiness.ts")
    && fs.fileExists("app/features/transport-kernel/transport-kernel-standalone-deletion-subtraction-prep-band-closure.ts")
  );

  const baselineReady = (
    legacyFilesPresent
    && legacyArchivePresent
    && portImportsLegacy
    && subtractedPortPresent
    && subtractedPortOmitsLegacyImport
    && thinPortTemplatePresent
    && thinPortOmitsLegacyImport
    && postDeletionOwnersPresent
    && semanticsOwnerPresent
    && contractPinsPresent
    && unitTestPinsPresent
    && existencePinMigrationReady
    && mechanicalSubtractionCommitReady
    && b5ExitVerificationReady
    && prepBandClosureReady
  );

  return {
    gateApproved,
    legacyFilesPresent,
    legacyArchivePresent,
    portImportsLegacy,
    subtractedPortPresent,
    subtractedPortOmitsLegacyImport,
    thinPortTemplatePresent,
    thinPortOmitsLegacyImport,
    postDeletionOwnersPresent,
    semanticsOwnerPresent,
    contractPinsPresent,
    unitTestPinsPresent,
    existencePinMigrationReady,
    mechanicalSubtractionCommitReady,
    b5ExitVerificationReady,
    prepBandClosureReady,
    readyForPhysicalDeletion: gateApproved && baselineReady,
  };
};
