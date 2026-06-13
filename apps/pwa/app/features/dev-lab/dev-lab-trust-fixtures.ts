import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  evaluateTrustThreatCorpus,
  type TrustThreatFixtureCaseResult,
  type TrustThreatCorpusResult,
} from "@/app/features/dm-kernel/dm-kernel-trust-threat-corpus";

export type DevLabTrustFixtureCaseResult = TrustThreatFixtureCaseResult;

export type DevLabTrustFixturesScenarioResult = TrustThreatCorpusResult;

/**
 * TRUST manual matrix + expanded adversary corpus — pure assessment port; no DOM or relay I/O.
 */
export const evaluateDevLabTrustFixturesScenario = (
  peerPublicKeyHex: PublicKeyHex,
): DevLabTrustFixturesScenarioResult => evaluateTrustThreatCorpus(peerPublicKeyHex);
