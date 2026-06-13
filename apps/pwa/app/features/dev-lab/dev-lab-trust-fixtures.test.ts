import { describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { evaluateDevLabAuth4ScopeProbe } from "./dev-lab-auth4-scope-probe";
import { evaluateDevLabTrustFixturesScenario } from "./dev-lab-trust-fixtures";

vi.mock("./dev-lab-policy", () => ({
  isDevLabEnabled: vi.fn(() => true),
}));

vi.mock("@/app/features/workspace-kernel/workspace-kernel-policy", () => ({
  isWorkspaceKernelAuthority: vi.fn(() => false),
}));

vi.mock("@/app/features/groups/services/community-leave-outbox", () => ({
  readCommunityLeaveOutbox: vi.fn(() => []),
}));

const PK_A = "aa".repeat(32) as PublicKeyHex;
const PK_B = "bb".repeat(32) as PublicKeyHex;

describe("dev-lab-trust-fixtures", () => {
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

describe("dev-lab-auth4-scope-probe", () => {
  it("accepts distinct profile pubkeys on same profile slot", () => {
    const probe = evaluateDevLabAuth4ScopeProbe({
      profileA: { publicKeyHex: PK_A, profileId: "default" },
      profileB: { publicKeyHex: PK_B, profileId: "default" },
      profileAAfterReload: { publicKeyHex: PK_A, profileId: "default" },
    });
    expect(probe.ok).toBe(true);
  });

  it("rejects shared public key", () => {
    const probe = evaluateDevLabAuth4ScopeProbe({
      profileA: { publicKeyHex: PK_A, profileId: "default" },
      profileB: { publicKeyHex: PK_A, profileId: "other" },
    });
    expect(probe.ok).toBe(false);
    expect(probe.issues).toContain("profiles_share_public_key");
  });
});
