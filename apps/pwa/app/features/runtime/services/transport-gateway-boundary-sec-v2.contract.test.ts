import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("transport and gateway boundary SEC-V2 contract (checklist §3 V3-1–V3-3)", () => {
  const pwaRoot = path.resolve(__dirname, "../../../..");
  const repoRoot = path.resolve(pwaRoot, "..", "..");
  const read = (relativePath: string) => readFileSync(path.join(pwaRoot, relativePath), "utf8");
  const readRepo = (relativePath: string) => readFileSync(path.join(repoRoot, relativePath), "utf8");

  it("V3-1: transport boundary script enforces @dweb/nostr allowlist", () => {
    const script = readRepo("scripts/verify-transport-boundaries.mjs");
    const allowlist = readRepo("scripts/transport-nostr-feature-allowlist.json");
    expect(script).toContain("@dweb/nostr");
    expect(allowlist).toContain("allowedRelativePaths");
  });

  it("V3-2: gateway boundary script mirrors ESLint restricted imports", () => {
    const script = readRepo("scripts/verify-client-gateway-boundaries.mjs");
    const eslint = readRepo("apps/pwa/eslint.config.mjs");
    expect(script).toContain("community-membership-ledger");
    expect(script).toContain("upsertCommunityMembershipLedgerEntry");
    expect(eslint).toContain("no-restricted-imports");
  });

  it("V3-3: membership ledger writes route through mutation owner, not parallel importers", () => {
    const groupProvider = read("app/features/groups/providers/group-provider.tsx");
    const workspacePort = read("app/features/workspace-kernel/workspace-kernel-membership-port.ts");
    const messagingOps = read("app/features/messaging/services/messaging-client-operations.ts");

    expect(groupProvider).toContain("persistCommunityMembershipLedgerMutation");
    expect(groupProvider).not.toContain("upsertCommunityMembershipLedgerEntry");
    expect(workspacePort).toContain("persistCommunityMembershipLedgerMutation");
    expect(workspacePort).not.toContain("upsertCommunityMembershipLedgerEntry");
    expect(messagingOps).toContain("messagingClientOperations");
  });

  it("verify:sec-v2-v1.9.5 chains transport + gateway boundary scripts", () => {
    const pkg = readFileSync(path.join(repoRoot, "package.json"), "utf8");
    expect(pkg).toContain("verify:sec-v2-v1.9.5");
    expect(pkg).toMatch(/transport:boundaries:check/);
    expect(pkg).toMatch(/gateway:boundaries:check/);
    expect(pkg).toMatch(/transport-gateway-boundary-sec-v2\.contract\.test\.ts/);
  });
});
