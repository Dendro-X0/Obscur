import { existsSync } from "node:fs";
import { join } from "node:path";
import { resolveStandaloneLegacyContractReadPath } from "@/app/features/transport-kernel/transport-kernel-standalone-deletion-contract-pins";
import { STANDALONE_LEGACY_FILES_TO_DELETE } from "@/app/features/transport-kernel/transport-kernel-standalone-deletion-subtraction-manifest";

/** True while production `-legacy.ts` and facade remain on disk. */
export const isStandaloneLegacyProductionPresent = (pwaRoot: string): boolean => (
  STANDALONE_LEGACY_FILES_TO_DELETE.every((relativePath) => (
    existsSync(join(pwaRoot, relativePath))
  ))
);

/** Engine-lab read path: production legacy while present, W60 archive after deletion. */
export const resolveTransportEngineStandaloneLegacyReadPath = (pwaRoot: string): string => (
  resolveStandaloneLegacyContractReadPath(isStandaloneLegacyProductionPresent(pwaRoot))
);
