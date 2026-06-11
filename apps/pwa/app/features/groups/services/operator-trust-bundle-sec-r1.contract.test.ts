import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("operator trust bundle SEC-R1 contract", () => {
    const pwaRoot = path.resolve(__dirname, "../../../..");
    const read = (relativePath: string) => readFileSync(path.join(pwaRoot, relativePath), "utf8");

    it("audit module validates coordination + workspace relay bundle", () => {
        const audit = read("app/features/groups/services/operator-trust-bundle-audit.ts");
        expect(audit).toContain("auditOperatorTrustBundle");
        expect(audit).toContain("readOperatorTrustBundleSnapshot");
        expect(audit).toContain("OPERATOR_TRUST_ALLOWED_WORKSPACE_RELAY_TIERS");
        expect(audit).toContain("assessWorkspaceCommunityTrust");
    });

    it("create dialog and invite redemption wire trust policy at create/join", () => {
        const dialog = read("app/features/groups/components/create-group-dialog.tsx");
        const redemption = read("app/features/groups/services/community-invite-redemption-policy.ts");
        expect(dialog).toContain("assessWorkspaceCommunityTrust");
        expect(redemption).toContain("assessWorkspaceCommunityTrust");
    });

    it("operator setup wizard persists bundle before workspace create", () => {
        const wizard = read("app/features/settings/components/operator-trust-setup-wizard.tsx");
        expect(wizard).toContain("writeOperatorCoordinationUrlOverride");
        expect(wizard).toContain("writeOperatorWorkspaceRelayUrl");
        expect(wizard).toContain("assessWorkspaceCommunityTrust");
    });

    it("verify:relay-v1.9.5 includes SEC-R1 audit tests", () => {
        const pkg = readFileSync(path.join(pwaRoot, "..", "..", "package.json"), "utf8");
        expect(pkg).toContain("verify:relay-v1.9.5");
        expect(pkg).toMatch(/operator-trust-bundle-audit\.test\.ts/);
    });
});
