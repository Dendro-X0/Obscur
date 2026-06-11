import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * W2 exit contract — thread-port + write-port wiring + COM-MSG gate script.
 */
describe("workspace-kernel W2 exit contract", () => {
  const repoRoot = path.resolve(__dirname, "../../../../../");
  const pwaRoot = path.resolve(__dirname, "../../..");
  const read = (relativePath: string) => readFileSync(path.join(pwaRoot, relativePath), "utf8");

  it("verify:workspace-kernel-w2 script exists", () => {
    const pkg = readFileSync(path.join(repoRoot, "package.json"), "utf8");
    expect(pkg).toContain("verify:workspace-kernel-w2");
  });

  it("use-chat-actions routes group send through workspace-kernel write-port", () => {
    const chatActions = read("app/features/main-shell/hooks/use-chat-actions.ts");
    expect(chatActions).toContain("sendWorkspaceKernelGroupMessage");
    expect(chatActions).toContain("isWorkspaceKernelAuthority");
    expect(chatActions).toMatch(/isWorkspaceKernelAuthority\(\)[\s\S]*sendWorkspaceKernelGroupMessage/);
  });

  it("use-group-thread-messages routes read through workspace-kernel thread-port", () => {
    const hook = read("app/features/messaging/hooks/use-group-thread-messages.ts");
    expect(hook).toContain("loadWorkspaceKernelGroupThreadPage");
    expect(hook).toContain("isWorkspaceKernelAuthority");
  });

  it("dm-kernel group thread port delegates to workspace-kernel thread-port", () => {
    const bridge = read("app/features/dm-kernel/dm-kernel-group-thread-port.ts");
    expect(bridge).toContain("workspace-kernel-thread-port");
    expect(bridge).toContain("@deprecated");
  });

  it("write-port commits through append owner not parallel chat-state", () => {
    const writePort = read("app/features/workspace-kernel/workspace-kernel-write-port.ts");
    expect(writePort).toContain("commitSealedGroupMessages");
    expect(writePort).not.toContain("use-sealed-community");
  });
});
