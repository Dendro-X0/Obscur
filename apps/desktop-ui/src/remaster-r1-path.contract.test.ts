import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const DESKTOP_UI_SRC = HERE;
const REPO_ROOT = join(HERE, "../../..");

const FORBIDDEN: ReadonlyArray<Readonly<{ id: string; re: RegExp }>> = [
  { id: "chat-state-store", re: /\bchat-state-store\b|\bPersistedChatState\b/ },
  { id: "dm_message_queue_v1", re: /dm_message_queue_v1/ },
  { id: "MessageQueue class", re: /\bclass MessageQueue\b|\bnew MessageQueue\b/ },
  { id: "apps/pwa feature import", re: /from ["']@\/app\/features\// },
  { id: "usePeerTrust hook", re: /\busePeerTrust\b/ },
];

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

describe("Remaster R1 path audit", () => {
  it("keeps desktop-ui free of Cut 1 kill-list / pwa authority imports", () => {
    const files = collectTsFiles(DESKTOP_UI_SRC);
    const hits: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const rule of FORBIDDEN) {
        if (rule.re.test(text)) {
          hits.push(`${relative(DESKTOP_UI_SRC, file)} · ${rule.id}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });

  it("documents remaster face + foundation bar", () => {
    const audit = readFileSync(
      join(REPO_ROOT, "specs/backend/remaster-r1-path-audit-2026-11-10.md"),
      "utf8",
    );
    const closeout = readFileSync(
      join(REPO_ROOT, "specs/backend/remaster-foundation-closeout-2026-11-10.md"),
      "utf8",
    );
    expect(audit).toContain("Sole remaster product face");
    expect(audit).toContain("≠ Continuity Pass");
    expect(closeout).toContain("stop inventing Continuity Cuts 16+");
    expect(closeout).toContain("R0–R5");
  });

  it("wires native private_dc T3 send without Nostr silent fallback", () => {
    const native = readFileSync(
      join(DESKTOP_UI_SRC, "private-trust/native-private-trust-ports.ts"),
      "utf8",
    );
    expect(native).toContain("sendPrivateTrustT3ViaHost");
    expect(native).toContain("guardPrivateTrustSendFace");
    expect(native).toContain("private_dc only");
  });
});
