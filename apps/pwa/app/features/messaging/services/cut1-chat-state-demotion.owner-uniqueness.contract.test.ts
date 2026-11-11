import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const PWA_ROOT = resolve(process.cwd());

const read = (relativePath: string): string => (
  readFileSync(resolve(PWA_ROOT, relativePath), "utf8")
);

const walkTsFiles = (absDir: string): ReadonlyArray<string> => {
  const out: string[] = [];
  for (const entry of readdirSync(absDir)) {
    const abs = join(absDir, entry);
    const st = statSync(abs);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === "dist") {
        continue;
      }
      out.push(...walkTsFiles(abs));
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) {
      out.push(abs);
    }
  }
  return out;
};

/** Social sticky CRM + protocol send — must not own chat-state CRM/message durability. */
const SOCIAL_SEND_BOUNDARY_GLOBS = [
  "app/features/network/hooks/use-peer-trust.ts",
  "app/features/network/services/relationship-edge-authority.ts",
  "app/features/protocol-adaptation/layer.ts",
  "app/features/protocol-adaptation/private-dc-adapter.ts",
  "app/features/protocol-adaptation/private-trust-t3-send.ts",
  "app/features/messaging/controllers/v2/dm-send-with-retry.ts",
] as const;

const FORBIDDEN_IMPORT_SNIPPETS = [
  "chat-state-store-legacy",
  "chatStateStoreService",
  "updateConnectionRequests",
  "updateMessages(",
  "messagingChatStateMessagePort",
] as const;

describe("Cut 1.5 K-CHATSTATE-AUTH owner-uniqueness", () => {
  it("policy defines CRM + message chat-state suppress predicates", () => {
    const policy = read("app/features/dm-kernel/dm-kernel-chat-state-io-policy.ts");
    expect(policy).toContain("isChatStateCrmIoSuppressed");
    expect(policy).toContain("isChatStateAuthorityIoSuppressed");
    expect(policy).toContain("connectionRequests: []");
    expect(policy).toContain("isDmKernelChatStateMessageIoSuppressed");
  });

  it("message port no-ops CRM writes and sanitizes authority fields on native", () => {
    const port = read("app/features/messaging/services/messaging-chat-state-message-port.ts");
    expect(port).toContain("isChatStateCrmIoSuppressed");
    expect(port).toContain("isChatStateAuthorityIoSuppressed");
    expect(port).toMatch(
      /updateConnectionRequests[\s\S]*?isChatStateCrmIoSuppressed\(\)[\s\S]*?return;/,
    );
    expect(port).toMatch(
      /updateMessages[\s\S]*?isDmKernelChatStateMessageIoSuppressed\(\)[\s\S]*?return;/,
    );
  });

  it("import boundary: social/send paths do not mutate chat-state CRM/messages", () => {
    for (const rel of SOCIAL_SEND_BOUNDARY_GLOBS) {
      const source = read(rel);
      for (const snippet of FORBIDDEN_IMPORT_SNIPPETS) {
        expect(source, `${rel} must not reference ${snippet}`).not.toContain(snippet);
      }
    }
  });

  it("protocol-adaptation tree does not import chat-state-store-legacy", () => {
    const absRoot = resolve(PWA_ROOT, "app/features/protocol-adaptation");
    for (const abs of walkTsFiles(absRoot)) {
      const rel = relative(PWA_ROOT, abs).replace(/\\/g, "/");
      const source = readFileSync(abs, "utf8");
      expect(source, `${rel} must not import chat-state-store-legacy`).not.toContain(
        "chat-state-store-legacy",
      );
      expect(source, `${rel} must not call chatStateStoreService`).not.toContain(
        "chatStateStoreService",
      );
    }
  });
});
