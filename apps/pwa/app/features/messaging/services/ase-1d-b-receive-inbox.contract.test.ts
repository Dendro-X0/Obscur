import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string): string => (
  readFileSync(resolve(process.cwd(), relativePath), "utf8")
);

describe("ASE-1d-b contact-request receive → inbox", () => {
  it("classifies connection lifecycle tags in dm-receive-pipeline", () => {
    const source = read("app/features/messaging/controllers/v2/dm-receive-pipeline.ts");
    expect(source).toContain("resolveContactRequestReceiveRoute");
    expect(source).toMatch(/action:\s*"contact_sandbox"/);
    expect(source).toMatch(/action:\s*"contact_lifecycle"/);
    expect(source).toMatch(/reason:\s*"stranger_dm_blocked"/);
  });

  it("feeds requestsInbox.upsertIncoming from dm-controller on sandbox receive", () => {
    const source = read("app/features/messaging/controllers/v2/dm-controller.ts");
    expect(source).toMatch(/case\s+"contact_sandbox"[\s\S]*upsertIncoming/);
    expect(source).toMatch(/applyIncomingContactLifecycle/);
  });

  it("wires requestsInbox into runtime transport owner", () => {
    const source = read("app/features/messaging/providers/runtime-messaging-transport-owner-provider.tsx");
    expect(source).toMatch(/useDmController\([\s\S]*requestsInbox/);
  });
});
