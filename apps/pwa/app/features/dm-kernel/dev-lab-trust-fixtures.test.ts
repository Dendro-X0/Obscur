import { describe, expect, it } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { evaluateDevLabTrustFixturesScenario } from "./dev-lab-trust-fixtures";

const PK_A = "aa".repeat(32) as PublicKeyHex;

describe("dev-lab-trust-fixtures (relocated to dm-kernel)", () => {
  it("passes TRUST manual matrix and expanded threat corpus", () => {
    const scenario = evaluateDevLabTrustFixturesScenario(PK_A);
    expect(scenario.ok).toBe(true);
    expect(scenario.cases.length).toBeGreaterThanOrEqual(30);
    expect(scenario.cases.map((entry) => entry.id).slice(0, 3)).toEqual([
      "trust_1_fin_cold_elevated",
      "trust_2_dismiss_suppresses_banner",
      "trust_3_accepted_peer_no_fin_cold",
    ]);
    expect(scenario.byCategory.manual_matrix).toBe(3);
  });
});
