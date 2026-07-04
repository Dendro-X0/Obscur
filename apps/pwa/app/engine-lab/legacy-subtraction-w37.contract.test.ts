import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ENGINE_LAB_SUBTRACTED_FILES } from "./legacy-subtraction-manifest";

const REPO_ROOT = join(__dirname, "../../../../");
const PWA_ROOT = join(REPO_ROOT, "apps/pwa");

const read = (relFromPwa: string): string => (
  readFileSync(join(PWA_ROOT, relFromPwa), "utf8")
);

describe("legacy subtraction w37 — sealed community hook deleted from legacy", () => {
  it("sealed community hook legacy file is tombstoned in manifest", () => {
    expect(ENGINE_LAB_SUBTRACTED_FILES).toContain(
      "app/legacy/use-sealed-community-legacy.ts",
    );
  });

  it("sealed community hook legacy file stays deleted", () => {
    expect(existsSync(join(PWA_ROOT, "app/legacy/use-sealed-community-legacy.ts"))).toBe(false);
  });

  it("canonical sealed community hook lives in features without legacy imports", () => {
    const source = read("app/features/groups/hooks/use-sealed-community-legacy.ts");
    expect(source).toContain("useLegacySealedCommunity");
    expect(source).toContain("use-sealed-community-types");
    expect(source).not.toMatch(/@\/app\/legacy\//);
  });

  it("sealed-community-port re-exports hook from features only", () => {
    const port = read("app/features/groups/hooks/sealed-community-port.ts");
    expect(port).toContain("./use-sealed-community-legacy");
    expect(port).not.toMatch(/@\/app\/legacy\//);
    expect(port).not.toContain("@/app/legacy/use-sealed-community-legacy");
  });

  it("main shell routes sealed community through sealed-community-port", () => {
    const mainShell = read("app/features/main-shell/main-shell.tsx");
    expect(mainShell).toContain("sealed-community-port");
    expect(mainShell).not.toContain("use-sealed-community-legacy");
    expect(mainShell).not.toContain("@/app/legacy/use-sealed-community-legacy");
  });
});
