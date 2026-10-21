import { describe, expect, it } from "vitest";
import {
  resolveOperatorApplySkipRelay,
  resolveOperatorPersistLabFlags,
} from "./operator-apply-skip-relay";

describe("resolveOperatorApplySkipRelay", () => {
  it("skips only when lab flag is on and relay field is empty", () => {
    expect(resolveOperatorApplySkipRelay({
      testWithoutRelay: true,
      normalizedWorkspaceRelayUrl: null,
    })).toBe(true);
  });

  it("does not skip enable when a workspace relay URL is typed", () => {
    expect(resolveOperatorApplySkipRelay({
      testWithoutRelay: true,
      normalizedWorkspaceRelayUrl: "ws://localhost:7000",
    })).toBe(false);
  });

  it("does not skip when lab flag is off", () => {
    expect(resolveOperatorApplySkipRelay({
      testWithoutRelay: false,
      normalizedWorkspaceRelayUrl: null,
    })).toBe(false);
  });
});

describe("resolveOperatorPersistLabFlags", () => {
  it("persists Advanced flags as selected after Save", () => {
    expect(resolveOperatorPersistLabFlags({
      testWithoutRelay: true,
      assumeLocalCoordination: true,
    })).toEqual({
      persistSkipRelay: true,
      persistAssumeLocal: true,
    });
  });
});
