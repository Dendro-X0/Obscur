import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Path B Band B1-4 exit contract — worker steward ACL on membership delta append.
 */
describe("path B B1-4 exit contract", () => {
  const coordRoot = path.resolve(__dirname, "..");
  const repoRoot = path.resolve(coordRoot, "..", "..");
  const read = (relativePath: string) => readFileSync(path.join(coordRoot, relativePath), "utf8");
  const readRepo = (relativePath: string) => readFileSync(path.join(repoRoot, relativePath), "utf8");

  it("membership delta ACL module documents steward rules", () => {
    const acl = read("src/membership-delta-acl.ts");
    expect(acl).toContain("Path B Band B1 steward ACL");
    expect(acl).toContain("evaluateMembershipDeltaAcl");
    expect(acl).toContain("join_requires_self_attestation");
    expect(acl).toContain("leave_requires_self_attestation");
    expect(acl).toContain("expel_requires_bootstrap_steward");
  });

  it("membership directory invokes ACL before D1 insert", () => {
    const directory = read("src/membership-directory.ts");
    expect(directory).toContain("evaluateMembershipDeltaAcl");
    expect(directory).toMatch(/if \(!aclDecision\.allowed\)[\s\S]*403/);
    expect(directory).toContain("verifyMembershipDeltaSignature");
  });

  it("ACL unit tests cover join, leave, and expel steward paths", () => {
    const tests = read("src/membership-delta-acl.test.ts");
    expect(tests).toContain("join_requires_self_attestation");
    expect(tests).toContain("leave_requires_self_attestation");
    expect(tests).toContain("expel_requires_bootstrap_steward");
  });

  it("directory handler tests reject forged leave (403 ACL)", () => {
    const tests = read("src/membership-directory.test.ts");
    expect(tests).toContain("leave_requires_self_attestation");
    expect(tests).toContain("steward ACL");
  });

  it("coordination README documents Path B B1 ACL on delta POST", () => {
    const readme = readRepo("apps/coordination/README.md");
    expect(readme).toContain("Path B B1 ACL");
    expect(readme).toContain("bootstrap steward");
  });
});
