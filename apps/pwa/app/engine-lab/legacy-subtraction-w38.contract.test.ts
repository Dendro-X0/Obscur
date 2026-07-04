import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ENGINE_LAB_SUBTRACTED_FILES } from "./legacy-subtraction-manifest";

const REPO_ROOT = join(__dirname, "../../../../");
const PWA_ROOT = join(REPO_ROOT, "apps/pwa");

const read = (relFromPwa: string): string => (
  readFileSync(join(PWA_ROOT, relFromPwa), "utf8")
);

describe("legacy subtraction w38 — group provider deleted from legacy", () => {
  it("group provider legacy file is tombstoned in manifest", () => {
    expect(ENGINE_LAB_SUBTRACTED_FILES).toContain(
      "app/legacy/group-provider-legacy.tsx",
    );
  });

  it("group provider legacy file stays deleted", () => {
    expect(existsSync(join(PWA_ROOT, "app/legacy/group-provider-legacy.tsx"))).toBe(false);
  });

  it("canonical group provider lives in features without legacy imports", () => {
    const source = read("app/features/groups/providers/group-provider-legacy.tsx");
    expect(source).toContain("LegacyGroupProvider");
    expect(source).toContain("messaging-chat-state-read-port");
    expect(source).toContain("messaging-chat-state-message-port");
    expect(source).not.toMatch(/@\/app\/legacy\//);
  });

  it("group-provider-port re-exports provider from features only", () => {
    const port = read("app/features/groups/providers/group-provider-port.tsx");
    expect(port).toContain("./group-provider-legacy");
    expect(port).not.toMatch(/@\/app\/legacy\//);
    expect(port).not.toContain("@/app/legacy/group-provider-legacy");
  });

  it("runtime shell routes group provider through group-provider-port", () => {
    const shell = read("app/features/runtime/components/unlocked-app-runtime-shell.tsx");
    expect(shell).toContain("group-provider-port");
    expect(shell).not.toContain("group-provider-legacy");
    expect(shell).not.toContain("@/app/legacy/group-provider-legacy");
  });
});
