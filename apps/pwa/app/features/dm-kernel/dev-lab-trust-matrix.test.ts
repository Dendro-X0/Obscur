import { describe, expect, it } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  DEV_LAB_TRUST_MATRIX_ROW_IDS,
  evaluateDevLabTrustMatrixScenario,
} from "./dev-lab-trust-matrix";

const PEER = "f".repeat(64) as PublicKeyHex;

describe("dev-lab-trust-matrix", () => {
  it("covers TRUST-1..6 and SPAM-1 matrix rows", () => {
    const scenario = evaluateDevLabTrustMatrixScenario(PEER);
    expect(scenario.ok).toBe(true);
    expect(scenario.rows.map((row) => row.matrixRowId)).toEqual([...DEV_LAB_TRUST_MATRIX_ROW_IDS]);
    expect(scenario.rows.every((row) => row.passed)).toBe(true);
  });

  it("is deterministic for identical peer input", () => {
    const first = evaluateDevLabTrustMatrixScenario(PEER);
    const second = evaluateDevLabTrustMatrixScenario(PEER);
    expect(first.rows.map((row) => ({
      id: row.matrixRowId,
      tier: row.assessment.tier,
      bundleId: row.assessment.bundleId,
    }))).toEqual(second.rows.map((row) => ({
      id: row.matrixRowId,
      tier: row.assessment.tier,
      bundleId: row.assessment.bundleId,
    })));
  });
});
