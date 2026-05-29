import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  isStrictManagedWorkspaceRelay,
  shouldApplyCommunityRelayHideFilter,
} from "./strict-managed-workspace";
import { writeOperatorWorkspaceRelayUrl } from "./operator-trust-config";

describe("strict-managed-workspace (D3)", () => {
  beforeEach(() => {
    writeOperatorWorkspaceRelayUrl(null);
  });

  afterEach(() => {
    writeOperatorWorkspaceRelayUrl(null);
  });

  it("is true for localhost workspace relay in dev", () => {
    expect(isStrictManagedWorkspaceRelay("ws://localhost:7000")).toBe(true);
    expect(shouldApplyCommunityRelayHideFilter("ws://127.0.0.1:7000")).toBe(true);
  });

  it("is true when relay matches operator trust config", () => {
    writeOperatorWorkspaceRelayUrl("wss://relay.example.com");
    expect(isStrictManagedWorkspaceRelay("wss://relay.example.com/")).toBe(true);
    expect(isStrictManagedWorkspaceRelay("wss://other.example.com")).toBe(false);
  });

  it("is false for empty or public relay", () => {
    expect(isStrictManagedWorkspaceRelay("")).toBe(false);
    expect(isStrictManagedWorkspaceRelay("wss://nos.lol")).toBe(false);
  });
});
