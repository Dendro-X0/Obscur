import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const DESKTOP_UI_SRC = HERE;
const REPO_ROOT = join(HERE, "../../..");

const readText = (relativePath: string): string => (
  readFileSync(join(REPO_ROOT, relativePath), "utf8")
);

const collectTsFiles = (dir: string): string[] => {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...collectTsFiles(full));
      continue;
    }
    if (/\.(ts|tsx)$/.test(name) && !name.includes(".test.") && !name.includes(".contract.")) {
      out.push(full);
    }
  }
  return out;
};

describe("Official Beta OB3 list/thread/composer chrome", () => {
  it("ships presentational chrome modules without pwa feature imports", () => {
    const row = readText("apps/desktop-ui/src/private-trust/chrome/ConversationRowView.tsx");
    const bubble = readText("apps/desktop-ui/src/private-trust/chrome/MessageBubbleView.tsx");
    const composer = readText("apps/desktop-ui/src/private-trust/chrome/ComposerView.tsx");
    const empty = readText("apps/desktop-ui/src/private-trust/chrome/EmptyThreadView.tsx");

    for (const text of [row, bubble, composer, empty]) {
      expect(text).not.toMatch(/from ["']@\/app\/features\//);
      expect(text).not.toContain("usePeerTrust");
      expect(text).not.toContain("MessagingProvider");
      expect(text).not.toContain("chat-state");
      expect(text).not.toContain("useIdentity");
    }

    expect(row).toContain("ConversationRowView");
    expect(row).toContain("onSelect");
    expect(bubble).toContain("MessageBubbleView");
    expect(bubble).toContain("@dweb/ui-kit/message-status");
    expect(composer).toContain("ComposerView");
    expect(composer).toContain("@dweb/ui-kit/textarea");
    expect(composer).toContain("@dweb/ui-kit/button");
    expect(empty).toContain("@dweb/ui-kit/empty-state");
  });

  it("binds PrivateTrustHome chrome to remaster ports only", () => {
    const home = readText("apps/desktop-ui/src/private-trust/PrivateTrustHome.tsx");
    expect(home).toContain("ConversationRowView");
    expect(home).toContain("MessageBubbleView");
    expect(home).toContain("ComposerView");
    expect(home).toContain("EmptyThreadView");
    expect(home).toContain("listConversations");
    expect(home).toContain("listMessages");
    expect(home).toContain("sendDm");
    expect(home).toContain("PrivateTrustHomePorts");
    expect(home).not.toMatch(/from ["']@\/app\/features\//);
    expect(home).not.toContain("usePeerTrust");
    expect(home).not.toContain("MessagingProvider");
  });

  it("keeps entire desktop-ui free of pwa feature imports after OB3", () => {
    const files = collectTsFiles(DESKTOP_UI_SRC);
    const hits: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      if (/from ["']@\/app\/features\//.test(text)) {
        hits.push(relative(DESKTOP_UI_SRC, file));
      }
    }
    expect(hits).toEqual([]);
  });

  it("documents OB3 closeout without Soft L3 / Continuity Pass claims", () => {
    const closeout = readText(
      "specs/backend/official-beta-ob3-shell-chrome-2026-11-11.md",
    );
    expect(closeout).toContain("CLOSED");
    expect(closeout).toContain("PrivateTrustHomePorts");
    expect(closeout).toContain("ConversationRowView");
    expect(closeout).toContain("ComposerView");
    expect(closeout).toContain("≠ Continuity Pass");
    expect(closeout).toContain("Soft L3 Fixed");
    expect(closeout).not.toMatch(/Soft L3 Fixed\s*\*\*Pass\*\*/);
    expect(closeout).not.toMatch(/Continuity Pass\s*\*\*claimed\*\*/);
    expect(closeout).toContain("OB4");
  });
});
