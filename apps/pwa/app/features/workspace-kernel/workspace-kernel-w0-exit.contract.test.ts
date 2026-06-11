import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * W0 exit contract — verify script + handoff pointer exist.
 */
describe("workspace-kernel W0 exit contract", () => {
  const repoRoot = path.resolve(__dirname, "../../../../../");
  const pwaRoot = path.resolve(__dirname, "../../..");

  it("verify:workspace-kernel-w0 script exists in root package.json", () => {
    const pkg = readFileSync(path.join(repoRoot, "package.json"), "utf8");
    expect(pkg).toContain("verify:workspace-kernel-w0");
  });

  it("handoff documents workspace-kernel strategy and W0 gate", () => {
    const handoff = readFileSync(
      path.join(repoRoot, "docs/handoffs/current-session.md"),
      "utf8",
    );
    expect(handoff).toContain("workspace-kernel");
    expect(handoff).toMatch(/verify:workspace-kernel-w[0-4]/);
    expect(handoff).toMatch(/W[0-4].*landed|workspace kernel.*complete/i);
  });

  it("workspace-kernel module exports policy and port scaffolds", () => {
    const index = readFileSync(
      path.join(pwaRoot, "app/features/workspace-kernel/index.ts"),
      "utf8",
    );
    expect(index).toContain("isWorkspaceKernelAuthority");
    expect(index).toContain("assertWorkspaceLeaveRequiresRelayConfirmation");
  });
});
