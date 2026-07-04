import { evaluateStandaloneLegacyB5ExitReadiness } from "./transport-kernel-standalone-deletion-b5-exit-readiness";
import { evaluateStandaloneLegacyExistencePinMigrationReadiness } from "./transport-kernel-standalone-deletion-existence-pin-migration-readiness";
import { evaluateStandaloneLegacyMechanicalSubtractionCommitReadiness } from "./transport-kernel-standalone-deletion-mechanical-subtraction-commit-readiness";
import {
  evaluateStandaloneLegacySubtractionDryRun,
  type StandaloneLegacySubtractionDryRunFilesystem,
} from "./transport-kernel-standalone-deletion-subtraction-dry-run";

export type StandaloneLegacySubtractionPrepBandClosureReport = Readonly<{
  gateApproved: boolean;
  prepBandComplete: boolean;
  readyForMaintainerExecution: boolean;
  postSubtractionExitComplete: boolean;
  dryRunReady: boolean;
  mechanicalCommitReady: boolean;
  pinMigrationReady: boolean;
  b5ExitPrepReady: boolean;
}>;

export const evaluateStandaloneLegacySubtractionPrepBandClosure = (
  signOffMarkdown: string,
  fs: StandaloneLegacySubtractionDryRunFilesystem,
): StandaloneLegacySubtractionPrepBandClosureReport => {
  const dryRun = evaluateStandaloneLegacySubtractionDryRun(signOffMarkdown, fs);
  const mechanical = evaluateStandaloneLegacyMechanicalSubtractionCommitReadiness(signOffMarkdown, fs);
  const pinMigration = evaluateStandaloneLegacyExistencePinMigrationReadiness(fs);
  const b5Exit = evaluateStandaloneLegacyB5ExitReadiness(signOffMarkdown, fs);

  const dryRunReady = dryRun.b5ExitVerificationReady;
  const mechanicalCommitReady = mechanical.preCommitBaselineReady;
  const pinMigrationReady = pinMigration.readyForPinFlipAfterSubtraction;
  const b5ExitPrepReady = b5Exit.preExitBaselineReady;

  const prepBandComplete = (
    dryRunReady
    && mechanicalCommitReady
    && pinMigrationReady
    && b5ExitPrepReady
    && !b5Exit.postSubtractionExitComplete
  );

  return {
    gateApproved: dryRun.gateApproved,
    prepBandComplete,
    readyForMaintainerExecution: dryRun.readyForPhysicalDeletion,
    postSubtractionExitComplete: b5Exit.postSubtractionExitComplete,
    dryRunReady,
    mechanicalCommitReady,
    pinMigrationReady,
    b5ExitPrepReady,
  };
};
