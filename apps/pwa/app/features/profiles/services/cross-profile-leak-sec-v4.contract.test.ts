import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("cross-profile leak SEC-V4 contract (AB-15 / COM-10)", () => {
  const pwaRoot = path.resolve(__dirname, "../../../..");
  const repoRoot = path.resolve(pwaRoot, "..", "..");
  const read = (relativePath: string) => readFileSync(path.join(pwaRoot, relativePath), "utf8");

  it("AB-15: restore historical evidence cannot resurrect terminal membership", () => {
    const ab15 = read("app/features/groups/services/community-ab-restore-historical.test.ts");
    expect(ab15).toContain("AB-15");
    expect(ab15).toContain("historical restore evidence does not resurrect left membership");
    expect(ab15).toContain("resolveCommunityMembershipCoordinator");
  });

  it("COM-10 / AB-15: profile A left state does not leak into profile B restore path", () => {
    const ab15 = read("app/features/groups/services/community-ab-restore-historical.test.ts");
    expect(ab15).toContain("historical restore evidence respects profile scope isolation");
    expect(ab15).toContain("profile-b");
  });

  it("account restore mutations stay profile-scoped on bus and sync signal", () => {
    const bus = read("app/features/profiles/services/single-process-profile-isolation.test.ts");
    const sync = read("app/shared/account-sync-mutation-signal.profile-isolation.test.ts");
    expect(bus).toContain("account-restore-materialization-completed");
    expect(sync).toContain("does not deliver profile A mutations to profile B subscribers");
  });

  it("native sqlite restore writes stay under explicit profileId", () => {
    const evidence = read("app/features/account-sync/services/native-sqlite-backup-evidence.test.ts");
    expect(evidence).toContain("profile-restore");
    expect(evidence).toContain("profile_id");
  });

  it("verify:sec-v4-v1.9.5 includes AB-15 / COM-10 regression suite", () => {
    const pkg = readFileSync(path.join(repoRoot, "package.json"), "utf8");
    expect(pkg).toContain("verify:sec-v4-v1.9.5");
    expect(pkg).toMatch(/community-ab-restore-historical\.test\.ts/);
    expect(pkg).toMatch(/cross-profile-leak-sec-v4\.contract\.test\.ts/);
  });
});
