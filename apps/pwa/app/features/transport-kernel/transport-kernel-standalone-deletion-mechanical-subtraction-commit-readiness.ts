import { evaluateStandaloneLegacyExistencePinMigrationReadiness } from "./transport-kernel-standalone-deletion-existence-pin-migration-readiness";
import { evaluateStandaloneLegacyPostSubtractionBaseline } from "./transport-kernel-standalone-deletion-post-subtraction-baseline";
import {
  evaluateStandaloneLegacySubtractionDryRun,
  type StandaloneLegacySubtractionDryRunFilesystem,
} from "./transport-kernel-standalone-deletion-subtraction-dry-run";

export type StandaloneLegacyMechanicalSubtractionCommitReport = Readonly<{
  gateApproved: boolean;
  preCommitBaselineReady: boolean;
  existencePinMigrationReady: boolean;
  postSubtractionComplete: boolean;
  readyForMechanicalSubtractionCommit: boolean;
}>;

export const evaluateStandaloneLegacyMechanicalSubtractionCommitReadiness = (
  signOffMarkdown: string,
  fs: StandaloneLegacySubtractionDryRunFilesystem,
): StandaloneLegacyMechanicalSubtractionCommitReport => {
  const dryRun = evaluateStandaloneLegacySubtractionDryRun(signOffMarkdown, fs);
  const pinMigration = evaluateStandaloneLegacyExistencePinMigrationReadiness(fs);
  const postSubtraction = evaluateStandaloneLegacyPostSubtractionBaseline(fs);

  const preCommitBaselineReady = (
    dryRun.legacyFilesPresent
    && dryRun.legacyArchivePresent
    && dryRun.portImportsLegacy
    && dryRun.subtractedPortPresent
    && dryRun.subtractedPortOmitsLegacyImport
    && dryRun.thinPortTemplatePresent
    && dryRun.thinPortOmitsLegacyImport
    && dryRun.existencePinMigrationReady
    && pinMigration.readyForPinFlipAfterSubtraction
    && !postSubtraction.postSubtractionComplete
  );

  const readyForMechanicalSubtractionCommit = dryRun.gateApproved && preCommitBaselineReady;

  return {
    gateApproved: dryRun.gateApproved,
    preCommitBaselineReady,
    existencePinMigrationReady: dryRun.existencePinMigrationReady,
    postSubtractionComplete: postSubtraction.postSubtractionComplete,
    readyForMechanicalSubtractionCommit,
  };
};
