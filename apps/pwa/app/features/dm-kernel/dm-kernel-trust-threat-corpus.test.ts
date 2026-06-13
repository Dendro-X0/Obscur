import { describe, expect, it } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  buildTrustThreatFixtureDefinitions,
  evaluateTrustThreatCorpus,
  THREAT_CORPUS_BASE_MS,
} from "./dm-kernel-trust-threat-corpus";

const PEER = "d".repeat(64) as PublicKeyHex;

describe("dm-kernel-trust-threat-corpus", () => {
  it("defines at least 30 adversary-shaped fixture cases", () => {
    const definitions = buildTrustThreatFixtureDefinitions(PEER);
    expect(definitions.length).toBeGreaterThanOrEqual(30);
  });

  it("passes the full deterministic threat corpus", () => {
    const corpus = evaluateTrustThreatCorpus(PEER);
    if (!corpus.ok) {
      const failures = corpus.cases
        .filter((entry) => !entry.passed)
        .map((entry) => `${entry.id}: ${entry.issues.join(", ")}`);
      expect.fail(`Threat corpus failures:\n${failures.join("\n")}`);
    }
    expect(corpus.ok).toBe(true);
  });

  it("covers manual matrix, financial, phishing, spam, and coordination lanes", () => {
    const corpus = evaluateTrustThreatCorpus(PEER);
    expect(corpus.byCategory.manual_matrix).toBeGreaterThanOrEqual(3);
    expect(corpus.byCategory.financial).toBeGreaterThanOrEqual(5);
    expect(corpus.byCategory.phishing).toBeGreaterThanOrEqual(3);
    expect(corpus.byCategory.spam).toBeGreaterThanOrEqual(3);
    expect(corpus.byCategory.coordination).toBeGreaterThanOrEqual(2);
  });

  it("uses stable corpus clock — not wall time", () => {
    const definitions = buildTrustThreatFixtureDefinitions(PEER);
    for (const definition of definitions) {
      const now = definition.input.nowUnixMs ?? 0;
      expect(now).toBeGreaterThanOrEqual(THREAT_CORPUS_BASE_MS);
      expect(now).toBeLessThan(THREAT_CORPUS_BASE_MS + 10_000_000_000);
    }
  });

  it("is deterministic for identical peer inputs", () => {
    const first = evaluateTrustThreatCorpus(PEER);
    const second = evaluateTrustThreatCorpus(PEER);
    expect(first.cases.map((entry) => ({
      id: entry.id,
      tier: entry.assessment.tier,
      bundleId: entry.assessment.bundleId,
    }))).toEqual(second.cases.map((entry) => ({
      id: entry.id,
      tier: entry.assessment.tier,
      bundleId: entry.assessment.bundleId,
    })));
  });
});
