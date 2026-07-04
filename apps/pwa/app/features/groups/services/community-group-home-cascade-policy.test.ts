import { describe, expect, it } from "vitest";
import { resolveGroupHomeCascadeGate } from "./community-group-home-cascade-policy";

describe("resolveGroupHomeCascadeGate", () => {
  it("enables side effects whenever the page has community context", () => {
    const gate = resolveGroupHomeCascadeGate({
      pageVisible: true,
      hasCommunityContext: true,
      workspaceKernelAuthority: true,
      communityMode: "managed_workspace",
    });
    expect(gate.heavySideEffectsEnabled).toBe(true);
    expect(gate.directoryRecoveryEnabled).toBe(true);
  });

  it("blocks when page is hidden", () => {
    const gate = resolveGroupHomeCascadeGate({
      pageVisible: false,
      hasCommunityContext: true,
      workspaceKernelAuthority: true,
      communityMode: "managed_workspace",
    });
    expect(gate.heavySideEffectsEnabled).toBe(false);
  });
});
