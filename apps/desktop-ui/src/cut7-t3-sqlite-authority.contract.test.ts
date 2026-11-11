import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Cut 7.3 — prefer SQLite T3; refuse chat-state-as-sole CRM in Continuity restore.
 * @see specs/backend/cut7-continuity-m1-sealed-file-design-2026-11-10.md
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "../../..");

const readText = (relativePath: string): string => (
  readFileSync(join(REPO_ROOT, relativePath), "utf8")
);

describe("Cut 7.3 T3 SQLite authority", () => {
  it("backup hydrate prefers SQLite on Tauri and refuses chat-state CRM invent", () => {
    const backup = readText(
      "apps/pwa/app/features/account-sync/services/encrypted-account-backup-service.ts",
    );
    expect(backup).toContain("Cut 7.3");
    expect(backup).toContain("collectNativeSqliteBackupEvidence");
    expect(backup).toContain("CHAT_STATE_AS_SOLE_CRM_REFUSED");
    expect(backup).toContain("chat-state peer hints are intentionally unused");
    expect(backup).toMatch(/if \(!isTauri\(\)\) \{\s*\n\s*await accountSyncChatStatePort\.hydrateMessages/);
  });

  it("ships Continuity T3/CRM policy module", () => {
    const policy = readText("apps/desktop-ui/src/continuity/t3-authority-policy.ts");
    expect(policy).toContain("resolveContinuityT3Authority");
    expect(policy).toContain("resolveContinuityCrmAuthority");
    expect(policy).toContain("CHAT_STATE_AS_SOLE_CRM_REFUSED");
    expect(policy).toContain("≠ Continuity Pass");
  });

  it("documents Cut 7.3 in design", () => {
    const spec = readText("specs/backend/cut7-continuity-m1-sealed-file-design-2026-11-10.md");
    expect(spec).toContain("Prefer native/SQLite evidence for T3");
    expect(spec).toContain("refuse chat-state-as-sole CRM");
  });
});
