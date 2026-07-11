import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string): string => (
  readFileSync(resolve(process.cwd(), relativePath), "utf8")
);

describe("ASE-1d-c contact-request send gating", () => {
  it("routes pending replies through connection-qna transport", () => {
    const source = read("app/features/messaging/services/request-transport-service.ts");
    expect(source).toMatch(/sendSandboxQna[\s\S]*connection-qna/);
  });

  it("blocks plain DM auto-accept in use-chat-actions", () => {
    const source = read("app/features/main-shell/hooks/use-chat-actions.ts");
    expect(source).toMatch(/resolveContactRequestComposeMode/);
    expect(source).toMatch(/sendSandboxQna/);
    expect(source).not.toMatch(/Auto-accept the peer/);
  });

  it("exposes offline sandbox compose policy", () => {
    const source = read("app/features/messaging/services/contact-request-sandbox-policy.ts");
    expect(source).toMatch(/sandbox_attachment_blocked/);
    expect(source).toMatch(/sandbox_text/);
  });
});
