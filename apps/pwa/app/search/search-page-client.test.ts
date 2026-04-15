import { describe, expect, it } from "vitest";
import { searchPageHelpers } from "./search-page-helpers";

describe("search-page deterministic query detection", () => {
  it("treats legacy OBSCUR invite codes as deterministic even when rollout flag is false", () => {
    expect(searchPageHelpers.isDeterministicDirectQuery("OBSCUR-BXEQ76", {
      allowLegacyInviteCode: false,
    })).toBe(true);
  });
});
