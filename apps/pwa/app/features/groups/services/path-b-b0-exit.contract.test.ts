import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Path B Band B0 exit contract — workspace create/join gates before membership subtraction (B1).
 */
describe("path B B0 exit contract", () => {
  const pwaRoot = path.resolve(__dirname, "../../../..");
  const repoRoot = path.resolve(pwaRoot, "..", "..");
  const read = (relativePath: string) => readFileSync(path.join(pwaRoot, relativePath), "utf8");
  const readRepo = (relativePath: string) => readFileSync(path.join(repoRoot, relativePath), "utf8");

  it("canonical trust policy blocks public_default and requires coordination", () => {
    const policy = read("app/features/groups/services/community-trust-policy.ts");
    expect(policy).toContain("assessWorkspaceCommunityTrust");
    expect(policy).toContain("public_relay_blocked");
    expect(policy).toContain("coordination_unconfigured");
    expect(policy).toContain("coordination_unreachable");
    expect(policy).toContain("isCoordinationGateSatisfied");
  });

  it("managed workspace relay gate rejects public_default tier", () => {
    const contract = read("app/features/groups/services/community-mode-contract.ts");
    expect(contract).toContain("resolveManagedWorkspaceRelayGate");
    expect(contract).toContain('tier === "public_default"');
    expect(contract).toContain("supportsManagedWorkspace");
  });

  it("dev escapes are production-gated", () => {
    const flags = read("app/features/groups/services/community-dev-flags.ts");
    expect(flags).toContain("isPathBWorkspaceDevEscapeAllowed");
    expect(flags).toContain('process.env.NODE_ENV !== "production"');
    expect(flags).toContain("NEXT_PUBLIC_OBSCUR_ALLOW_WORKSPACE_DEV_ESCAPES");
  });

  it("create dialog wires trust + managed relay gates", () => {
    const dialog = read("app/features/groups/components/create-group-dialog.tsx");
    expect(dialog).toContain("assessWorkspaceCommunityTrust");
    expect(dialog).toContain("resolveManagedWorkspaceRelayGate");
    expect(dialog).toContain('communityMode: "managed_workspace"');
    expect(dialog).toContain("probeCoordinationHealth");
  });

  it("global create handler re-checks trust before publish", () => {
    const manager = read("app/features/messaging/components/global-dialog-manager.tsx");
    expect(manager).toContain("assessWorkspaceCommunityTrustAsync");
    expect(manager).toContain('communityMode = "managed_workspace"');
  });

  it("invite redemption partitions workspace relays through trust policy", () => {
    const redemption = read("app/features/groups/services/community-invite-redemption-policy.ts");
    expect(redemption).toContain("assessWorkspaceCommunityTrust");
    expect(redemption).toContain("partitionInviteRelayHints");
  });

  it("coordination README documents K-M1/K-M2 local matrix", () => {
    const readme = readRepo("apps/coordination/README.md");
    expect(readme).toContain("Path B local matrix");
    expect(readme).toContain("verify:path-b-b0");
    expect(readme).toContain("/health");
  });

  it("pwa env example documents coordination URL for Path B", () => {
    const envExample = readRepo("apps/pwa/.env.example");
    expect(envExample).toContain("NEXT_PUBLIC_COORDINATION_URL");
    expect(envExample).toContain("managed_workspace");
  });
});
