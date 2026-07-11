import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string): string => (
  readFileSync(resolve(process.cwd(), relativePath), "utf8")
);

describe("ASE-1d-d sandbox enforcement at all send entry points", () => {
  it("gates dm-controller.sendDm through assertDmOutboundAllowed", () => {
    const source = read("app/features/messaging/controllers/v2/dm-controller.ts");
    expect(source).toMatch(/sendDmAction[\s\S]*assertDmOutboundAllowed/);
    expect(source).toMatch(/resolveContactRequestComposeMode/);
  });

  it("owns canonical outbound policy in contact-request-sandbox-policy", () => {
    const source = read("app/features/messaging/services/contact-request-sandbox-policy.ts");
    expect(source).toContain("assertDmOutboundAllowed");
    expect(source).toContain("assertNoBlockedSecretMaterial");
    expect(source).toMatch(/sandbox_plain_dm_blocked/);
  });
});
