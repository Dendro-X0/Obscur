import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string): string => (
  readFileSync(resolve(process.cwd(), relativePath), "utf8")
);

describe("peer-trust profile-scope hardening (Containment D)", () => {
  it("scopes peerTrust persistence through getPeerTrustStorageKey", () => {
    const source = read("app/features/network/hooks/use-peer-trust.ts");
    expect(source).toMatch(/getPeerTrustStorageKey/);
    expect(source).toMatch(/canInheritUnscopedPeerTrust/);
    expect(source).toMatch(/activeProfileId/);
    expect(source).not.toMatch(/return `obscur\.peer_trust\.v1\.\$\{publicKeyHex\}`/);
  });
});
