import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "../../../../");
const PWA_ROOT = join(REPO_ROOT, "apps/pwa");

const read = (relFromPwa: string): string => (
  readFileSync(join(PWA_ROOT, relFromPwa), "utf8")
);

const W23_LEGACY_TARGETS = [
  "use-sealed-community-legacy",
  "dm-conversation-projection-evidence-messages-legacy",
  "dm-conversation-projection-live-merge-legacy",
  "dm-conversation-materialization-load-earlier-legacy",
  "dm-conversation-materialization-realtime-legacy",
  "native-dm-thread-hydrate-legacy",
] as const;

const W23_ROUTED_PRODUCTION_PATHS = [
  "app/features/main-shell/main-shell.tsx",
  "app/features/groups/components/group-join-dialog.tsx",
  "app/features/groups/components/group-management-dialog.tsx",
  "app/groups/leave/page.tsx",
  "app/groups/[...id]/group-home-page-client.tsx",
  "app/features/messaging/services/thread-history/dm-adapter.ts",
  "app/features/messaging/services/thread-history/native-dm-adapter.ts",
] as const;

describe("legacy subtraction w23 — sealed community and thread-history ports", () => {
  it("w23 production paths do not import w23 legacy targets directly", () => {
    for (const relativePath of W23_ROUTED_PRODUCTION_PATHS) {
      const source = read(relativePath);
      for (const target of W23_LEGACY_TARGETS) {
        expect(source, `${relativePath} must not import ${target}`).not.toContain(target);
      }
    }
  });

  it("sealed-community surfaces import sealed-community-port", () => {
    const mainShell = read("app/features/main-shell/main-shell.tsx");
    expect(mainShell).toContain("sealed-community-port");
    expect(mainShell).toContain("resolveMainShellSealedCommunityEnabled");
    expect(mainShell).not.toContain("use-sealed-community-legacy");
  });

  it("thread-history adapters import legacy slices only through dm-thread-history-legacy-port", () => {
    const webAdapter = read("app/features/messaging/services/thread-history/dm-adapter.ts");
    const nativeAdapter = read("app/features/messaging/services/thread-history/native-dm-adapter.ts");
    expect(webAdapter).toContain("dm-thread-history-legacy-port");
    expect(nativeAdapter).toContain("dm-thread-history-legacy-port");
    expect(webAdapter).not.toMatch(/@\/app\/legacy\/dm-conversation-/);
    expect(nativeAdapter).not.toMatch(/@\/app\/legacy\/dm-conversation-/);
    expect(nativeAdapter).not.toContain("native-dm-thread-hydrate-legacy");
  });

  it("sealed-community instance policy gates legacy hook on workspace-kernel authority", () => {
    const policy = read("app/features/groups/services/sealed-community-instance-policy.ts");
    expect(policy).toContain("isWorkspaceKernelAuthority");
    expect(policy).toContain("resolveMainShellSealedCommunityEnabled");
    expect(policy).toContain("resolveGroupHomeSealedCommunityEnabled");
  });
});
