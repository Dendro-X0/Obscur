import {
  STANDALONE_LEGACY_ARCHIVE_PATH,
  STANDALONE_LEGACY_FILES_TO_DELETE,
  STANDALONE_LEGACY_PORT_PATHS_TO_UPDATE,
  STANDALONE_LEGACY_SUBTRACTED_PORT_PATH,
  STANDALONE_LEGACY_THIN_PORT_PATH,
} from "./transport-kernel-standalone-deletion-subtraction-manifest";
import { STANDALONE_LEGACY_PORT_IMPORT_TOKEN } from "./transport-kernel-standalone-deletion-contract-pins";
import type { StandaloneLegacySubtractionDryRunFilesystem } from "./transport-kernel-standalone-deletion-subtraction-dry-run";

export type StandaloneLegacyPostSubtractionBaselineReport = Readonly<{
  legacyFilesAbsent: boolean;
  portOmitsLegacyImport: boolean;
  subtractedPortPresent: boolean;
  thinPortTemplatePresent: boolean;
  thinPortOmitsLegacyImport: boolean;
  legacyArchivePresent: boolean;
  postSubtractionComplete: boolean;
}>;

export const evaluateStandaloneLegacyPostSubtractionBaseline = (
  fs: StandaloneLegacySubtractionDryRunFilesystem,
): StandaloneLegacyPostSubtractionBaselineReport => {
  const legacyFilesAbsent = STANDALONE_LEGACY_FILES_TO_DELETE.every((path) => !fs.fileExists(path));
  const portText = fs.readText(STANDALONE_LEGACY_PORT_PATHS_TO_UPDATE[0]!);
  const portOmitsLegacyImport = !portText.includes(STANDALONE_LEGACY_PORT_IMPORT_TOKEN);

  const subtractedPortPresent = fs.fileExists(STANDALONE_LEGACY_SUBTRACTED_PORT_PATH);
  const thinPortTemplatePresent = fs.fileExists(STANDALONE_LEGACY_THIN_PORT_PATH);
  const thinPortText = thinPortTemplatePresent ? fs.readText(STANDALONE_LEGACY_THIN_PORT_PATH) : "";
  const thinPortOmitsLegacyImport = thinPortTemplatePresent
    && !thinPortText.includes(STANDALONE_LEGACY_PORT_IMPORT_TOKEN)
    && thinPortText.includes("relay-standalone-publish-port-subtracted");

  const legacyArchivePresent = fs.fileExists(STANDALONE_LEGACY_ARCHIVE_PATH);

  const postSubtractionComplete = (
    legacyFilesAbsent
    && portOmitsLegacyImport
    && subtractedPortPresent
    && thinPortTemplatePresent
    && thinPortOmitsLegacyImport
    && legacyArchivePresent
  );

  return {
    legacyFilesAbsent,
    portOmitsLegacyImport,
    subtractedPortPresent,
    thinPortTemplatePresent,
    thinPortOmitsLegacyImport,
    legacyArchivePresent,
    postSubtractionComplete,
  };
};
