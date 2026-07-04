import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Path B Band B3-1 exit contract — one canonical group message send path.
 */
describe("path B B3-1 exit contract", () => {
  const pwaRoot = path.resolve(__dirname, "../../../..");
  const repoRoot = path.resolve(pwaRoot, "..", "..");
  const read = (relativePath: string) => readFileSync(path.join(pwaRoot, relativePath), "utf8");

  it("use-chat-actions owns outbound group send with relay publish + sqlite commit", () => {
    const chatActions = read("app/features/main-shell/hooks/use-chat-actions.ts");
    expect(chatActions).toContain("sendWorkspaceKernelGroupMessage");
    expect(chatActions).toContain("publishGroupEvent");
    expect(chatActions).toContain("commitSealedGroupMessages");
    expect(chatActions).toContain("sendSealedMessage");
    expect(chatActions).toContain("messageBus.emitNewMessage");
  });

  it("use-sealed-community sendMessage is subtracted (no-op)", () => {
    const sealed = read("app/features/groups/hooks/use-sealed-community-legacy.ts");
    expect(sealed).toContain("Path B B3-1");
    expect(sealed).toContain("sendMessage: noopAsync");
    expect(sealed).not.toMatch(/sendMessage:[\s\S]*GroupService/);
  });

  it("group-messaging stub policy remains for dev-lab surfaces only", () => {
    const stub = read("app/features/groups/services/group-messaging-stub-policy.ts");
    const devLab = read("app/features/dev-lab/dev-lab-install.ts");
    expect(stub).toContain("GROUP_MESSAGING_STUB_MESSAGE");
    expect(devLab).toContain("GROUP_MESSAGING_STUB_MESSAGE");
  });

  it("P5 gate documents canonical send owner", () => {
    const p5 = read("app/features/account-sync/services/p5-persistence-authority-gates.test.ts");
    expect(p5).toContain("P5-COM-MSG");
    expect(p5).toContain("commitSealedGroupMessages");
  });

  it("verify path-b-b3-1 script exists", () => {
    const pkg = readFileSync(path.join(repoRoot, "package.json"), "utf8");
    expect(pkg).toContain("verify:path-b-b3-1");
  });
});
