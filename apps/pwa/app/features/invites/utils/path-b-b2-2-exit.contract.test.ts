import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Path B Band B2-2 exit contract — invite-manager reads v2 relay list (same as use-relay-list).
 */
describe("path B B2-2 exit contract", () => {
  const pwaRoot = path.resolve(__dirname, "../../../..");
  const repoRoot = path.resolve(pwaRoot, "..", "..");
  const read = (relativePath: string) => readFileSync(path.join(pwaRoot, relativePath), "utf8");

  it("invite-manager imports canonical enabled relay loader", () => {
    const inviteManager = read("app/features/invites/utils/invite-manager.ts");
    expect(inviteManager).toContain("loadEnabledRelayUrlsForIdentity");
    expect(inviteManager).not.toMatch(/obscur\.relay_list\.v1\./);
    expect(inviteManager).not.toMatch(/obscur\.relay_list\.v2\./);
  });

  it("invite-manager uses enabled relays for coordination create and connection publish", () => {
    const inviteManager = read("app/features/invites/utils/invite-manager.ts");
    expect(inviteManager).toMatch(/loadEnabledRelayUrlsForIdentity\(identity\.publicKey\)/);
    expect(inviteManager).toContain("coordinationCreateInvite");
    expect(inviteManager).toContain("publishToUrlsStandalone(targetRelays");
  });

  it("relay-list-enabled-urls reads v2 before v1 (same order as use-relay-list)", () => {
    const loader = read("app/features/relays/services/relay-list-enabled-urls.ts");
    const hook = read("app/features/relays/hooks/use-relay-list.ts");
    expect(loader).toContain("obscur.relay_list.v2.");
    expect(loader).toContain("getRelayListStorageKeyV2");
    expect(hook).toContain("obscur.relay_list.v2.");
    expect(loader).toContain("same v2/v1 storage order as `use-relay-list`");
  });

  it("relay list loader tests cover v2 primary and v1 fallback", () => {
    const tests = read("app/features/relays/services/relay-list-enabled-urls.test.ts");
    expect(tests).toContain("reads v2 relay list storage key (same as use-relay-list)");
    expect(tests).toContain("falls back to scoped v1 when v2 is absent");
  });

  it("verify path-b-b2 includes relay list alignment gate", () => {
    const pkg = readFileSync(path.join(repoRoot, "package.json"), "utf8");
    expect(pkg).toContain("verify:path-b-b2-2");
    expect(pkg).toContain("relay-list-enabled-urls.test.ts");
  });
});
