import { evaluateStandaloneLegacyMechanicalSubtractionCommitReadiness } from "./transport-kernel-standalone-deletion-mechanical-subtraction-commit-readiness";
import { evaluateStandaloneLegacyPostSubtractionBaseline } from "./transport-kernel-standalone-deletion-post-subtraction-baseline";
import { STANDALONE_LEGACY_SEMANTICS_OWNER_PRESERVED } from "./transport-kernel-standalone-deletion-subtraction-manifest";
import { STANDALONE_LEGACY_B5_EXIT_POST_DELETION_OWNERS } from "./transport-kernel-standalone-deletion-b5-exit";
import type { StandaloneLegacySubtractionDryRunFilesystem } from "./transport-kernel-standalone-deletion-subtraction-dry-run";

export type StandaloneLegacyB5ExitReport = Readonly<{
  preExitBaselineReady: boolean;
  postSubtractionExitComplete: boolean;
  postDeletionOwnersPresent: boolean;
  semanticsOwnerPresent: boolean;
  readyForB5ExitVerification: boolean;
}>;

export const evaluateStandaloneLegacyB5ExitReadiness = (
  signOffMarkdown: string,
  fs: StandaloneLegacySubtractionDryRunFilesystem,
): StandaloneLegacyB5ExitReport => {
  const mechanical = evaluateStandaloneLegacyMechanicalSubtractionCommitReadiness(signOffMarkdown, fs);
  const postSubtraction = evaluateStandaloneLegacyPostSubtractionBaseline(fs);

  const postDeletionOwnersPresent = STANDALONE_LEGACY_B5_EXIT_POST_DELETION_OWNERS.every((path) => (
    fs.fileExists(path)
  ));
  const semanticsOwnerPresent = fs.fileExists(STANDALONE_LEGACY_SEMANTICS_OWNER_PRESERVED);

  const preExitBaselineReady = (
    mechanical.preCommitBaselineReady
    && postDeletionOwnersPresent
    && semanticsOwnerPresent
    && !postSubtraction.postSubtractionComplete
  );

  const postSubtractionExitComplete = postSubtraction.postSubtractionComplete;

  const readyForB5ExitVerification = (
    postSubtractionExitComplete
    && postDeletionOwnersPresent
    && semanticsOwnerPresent
  );

  return {
    preExitBaselineReady,
    postSubtractionExitComplete,
    postDeletionOwnersPresent,
    semanticsOwnerPresent,
    readyForB5ExitVerification,
  };
};
