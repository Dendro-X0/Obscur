import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ENGINE_LAB_SUBTRACTED_FILES } from "./legacy-subtraction-manifest";

const REPO_ROOT = join(__dirname, "../../../../");
const PWA_ROOT = join(REPO_ROOT, "apps/pwa");

const read = (relFromPwa: string): string => (
  readFileSync(join(PWA_ROOT, relFromPwa), "utf8")
);

describe("legacy subtraction w33 — dm read authority deleted from legacy", () => {
  it("read authority legacy file is tombstoned in manifest", () => {
    expect(ENGINE_LAB_SUBTRACTED_FILES).toContain(
      "app/legacy/dm-read-authority-contract-legacy.ts",
    );
  });

  it("read authority legacy file stays deleted", () => {
    expect(existsSync(join(PWA_ROOT, "app/legacy/dm-read-authority-contract-legacy.ts"))).toBe(false);
  });

  it("canonical read authority contract lives in features without legacy imports", () => {
    const source = read("app/features/messaging/services/dm-read-authority-contract.ts");
    expect(source).toContain("resolveHydrationDmReadMessages");
    expect(source).toContain("resolveLegacyHydrationAuthority");
    expect(source).not.toMatch(/@\/app\/legacy\//);
  });

  it("dm-read-authority-port re-exports contract from features only", () => {
    const port = read("app/features/messaging/services/dm-read-authority-port.ts");
    expect(port).toContain("./dm-read-authority-contract");
    expect(port).not.toMatch(/@\/app\/legacy\//);
    expect(port).not.toContain("dm-read-authority-contract-legacy");
  });

  it("hydrate read model routes authority through dm-read-authority-port", () => {
    const readModel = read("app/features/messaging/services/thread-history/hydrate-read-model.ts");
    expect(readModel).toContain("dm-read-authority-port");
    expect(readModel).not.toContain("dm-read-authority-contract-legacy");
  });
});
