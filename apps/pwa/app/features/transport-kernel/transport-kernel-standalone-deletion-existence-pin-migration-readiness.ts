import {
  STANDALONE_LEGACY_GATE_CLOSED_EXISTENCE_PIN_CONTRACTS,
  STANDALONE_LEGACY_GATE_CLOSED_PIN_MARKERS,
} from "./transport-kernel-standalone-deletion-existence-pin-migration";
import type { StandaloneLegacySubtractionDryRunFilesystem } from "./transport-kernel-standalone-deletion-subtraction-dry-run";

export type StandaloneLegacyExistencePinMigrationReport = Readonly<{
  pinContractsPresent: boolean;
  gateClosedPinsAssertLegacyPresent: boolean;
  pinContractCount: number;
  readyForPinFlipAfterSubtraction: boolean;
}>;

const contractContainsGateClosedPin = (contractText: string): boolean => (
  STANDALONE_LEGACY_GATE_CLOSED_PIN_MARKERS.some((marker) => contractText.includes(marker))
);

export const evaluateStandaloneLegacyExistencePinMigrationReadiness = (
  fs: StandaloneLegacySubtractionDryRunFilesystem,
): StandaloneLegacyExistencePinMigrationReport => {
  const pinContractsPresent = STANDALONE_LEGACY_GATE_CLOSED_EXISTENCE_PIN_CONTRACTS.every((path) => (
    fs.fileExists(path)
  ));

  const gateClosedPinsAssertLegacyPresent = STANDALONE_LEGACY_GATE_CLOSED_EXISTENCE_PIN_CONTRACTS.every((path) => {
    if (!fs.fileExists(path)) {
      return false;
    }
    return contractContainsGateClosedPin(fs.readText(path));
  });

  const readyForPinFlipAfterSubtraction = pinContractsPresent && gateClosedPinsAssertLegacyPresent;

  return {
    pinContractsPresent,
    gateClosedPinsAssertLegacyPresent,
    pinContractCount: STANDALONE_LEGACY_GATE_CLOSED_EXISTENCE_PIN_CONTRACTS.length,
    readyForPinFlipAfterSubtraction,
  };
};
