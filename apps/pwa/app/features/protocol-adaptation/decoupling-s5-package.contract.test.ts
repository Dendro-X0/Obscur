import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  OBSCUR_NOSTR_IMPLEMENTATION_HOME,
  OBSCUR_NOSTR_PACKAGE_NAME,
  OBSCUR_NOSTR_PROTOCOL_ID,
  OBSCUR_NOSTR_PRIVATE_SEND,
} from "@obscur/protocol-nostr";

/**
 * Slice S5 — workspace package exists as the Obscur-Nostr attachment point.
 * Live adapter body stays under IMPLEMENTATION_HOME until a later extract.
 */
describe("decoupling S5 @obscur/protocol-nostr package", () => {
  const repoRoot = path.resolve(__dirname, "../../../../../");
  const packageJsonPath = path.join(repoRoot, "packages/obscur-protocol-nostr/package.json");
  const pwaPackageJson = JSON.parse(
    readFileSync(path.join(repoRoot, "apps/pwa/package.json"), "utf8"),
  ) as { dependencies: Record<string, string> };
  const shim = readFileSync(path.join(__dirname, "port-surfaces.ts"), "utf8");
  const adapterExists = existsSync(
    path.join(repoRoot, "apps/pwa/app/features/protocol-adaptation/nostr/nostr-adapter.ts"),
  );

  it("registers the workspace package and pwa dependency", () => {
    expect(existsSync(packageJsonPath)).toBe(true);
    const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { name: string };
    expect(pkg.name).toBe("@obscur/protocol-nostr");
    expect(OBSCUR_NOSTR_PACKAGE_NAME).toBe("@obscur/protocol-nostr");
    expect(pwaPackageJson.dependencies["@obscur/protocol-nostr"]).toBe("workspace:*");
  });

  it("keeps live adapter under the documented implementation home", () => {
    expect(OBSCUR_NOSTR_PROTOCOL_ID).toBe("nostr");
    expect(OBSCUR_NOSTR_IMPLEMENTATION_HOME).toBe(
      "apps/pwa/app/features/protocol-adaptation/nostr/",
    );
    expect(adapterExists).toBe(true);
    expect(OBSCUR_NOSTR_PRIVATE_SEND).toBe("nostrAdapter.sendDm");
  });

  it("re-exports port surfaces from the package in the pwa shim", () => {
    expect(shim).toContain("@obscur/protocol-nostr");
  });
});
