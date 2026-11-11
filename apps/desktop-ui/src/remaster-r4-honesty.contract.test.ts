import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  REMASTER_AUTH_META,
  REMASTER_NON_CLAIMS,
  REMASTER_SHELL_HONESTY,
} from "./remaster-honesty-copy";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "../../..");

const readText = (relativePath: string): string => (
  readFileSync(join(REPO_ROOT, relativePath), "utf8")
);

describe("Remaster R4 honesty", () => {
  it("exports remaster honesty strings without Pass claims", () => {
    expect(REMASTER_SHELL_HONESTY).toContain("Private-trust remaster");
    expect(REMASTER_SHELL_HONESTY).toContain("Continuity methods available");
    expect(REMASTER_SHELL_HONESTY).toContain("product door");
    expect(REMASTER_SHELL_HONESTY).toContain("Continuity Pass not claimed");
    expect(REMASTER_AUTH_META).toContain("unlock ≠ Continuity");
    expect(REMASTER_NON_CLAIMS).toEqual(expect.arrayContaining([
      "Soft L3 Fixed",
      "Continuity Pass",
      "Tor Verified",
    ]));
  });

  it("wires honesty into AuthDoor + PrivateTrustHome", () => {
    const auth = readText("apps/desktop-ui/src/auth/AuthDoor.tsx");
    const home = readText("apps/desktop-ui/src/private-trust/PrivateTrustHome.tsx");
    expect(auth).toContain("REMASTER_AUTH_META");
    expect(home).toContain("REMASTER_SHELL_HONESTY");
  });

  it("documents R4 design + remaster release honesty notes", () => {
    const design = readText("specs/backend/remaster-r4-honesty-design-2026-11-10.md");
    const draft = readText("docs/releases/remaster-beta-release-notes-draft-2026-11-10.md");
    const published = readText("docs/releases/v2.0.0-beta.10-release.md");
    expect(design).toContain("≠ Continuity Pass");
    expect(design).toContain("Continuity methods available");
    expect(draft).toMatch(/DRAFT|SUPERSEDED/);
    expect(draft).toContain("not Continuity Pass");
    expect(published).toContain("Continuity Pass not claimed");
    expect(published).toContain("Soft L3");
  });

  it("keeps download + channel honesty aligned", () => {
    const download = readText("apps/website/src/app/download/page.tsx");
    const channel = readText("apps/desktop/release/channel/stable/README.md");
    expect(download).toContain("Continuity methods available");
    expect(download).toContain("not Continuity Pass");
    expect(download).toContain("not Soft L3 Fixed");
    expect(channel).toContain("private-trust remaster");
    expect(channel).toContain("Continuity Pass");
  });
});
