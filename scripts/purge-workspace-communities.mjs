#!/usr/bin/env node
/**
 * Purge managed-workspace communities from:
 * 1) Local coordination D1 (membership directory)
 * 2) Desktop/PWA WebView localStorage (Playwright persistent context)
 *
 * Quit Obscur before running so WebView files are not locked.
 *
 * Usage:
 *   node scripts/purge-workspace-communities.mjs
 *   node scripts/purge-workspace-communities.mjs --match NewTest
 *   node scripts/purge-workspace-communities.mjs --all-groups
 *   node scripts/purge-workspace-communities.mjs --profile profile-2
 */

import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const coordinationDir = path.join(repoRoot, "apps", "coordination");
const pwaDir = path.join(repoRoot, "apps", "pwa");

const args = process.argv.slice(2);
const matchSubstrings = args.includes("--all-groups")
  ? []
  : (() => {
      const matchIndex = args.indexOf("--match");
      if (matchIndex >= 0 && args[matchIndex + 1]) {
        return [args[matchIndex + 1]];
      }
      return ["NewTest"];
    })();

const profileArgIndex = args.indexOf("--profile");
const profileId = profileArgIndex >= 0 && args[profileArgIndex + 1]
  ? args[profileArgIndex + 1]
  : "default";

const purgeCoordinationDb = () => {
  console.log("\n[1/2] Purging coordination D1 membership directory...");
  const result = spawnSync(
    "pnpm",
    ["exec", "wrangler", "d1", "execute", "obscur", "--local", "--file=./scripts/purge-membership-directory.sql"],
    { cwd: coordinationDir, stdio: "inherit", shell: process.platform === "win32" },
  );
  if (result.status !== 0) {
    console.error("Coordination purge failed.");
    return false;
  }
  console.log("Coordination membership directory cleared.");
  return true;
};

const purgeDesktopWebViewDirectory = (userDataDir) => {
  if (!userDataDir) {
    return false;
  }
  try {
    fs.rmSync(userDataDir, { recursive: true, force: true });
    console.log("Removed desktop WebView storage (all local UI data for this profile).");
    return true;
  } catch (error) {
    console.warn(`Failed to remove WebView dir: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
};

const resolveDesktopWebViewDir = () => {
  const appData = process.env.APPDATA || process.env.HOME;
  if (!appData) {
    return null;
  }
  const dir = path.join(appData, "app.obscur.desktop", "profiles", profileId, "EBWebView");
  return fs.existsSync(dir) ? dir : null;
};

const purgeBrowserLocalState = async () => {
  console.log("\n[2/2] Purging desktop WebView localStorage...");
  console.log("Ensure Obscur is fully quit before this step.");

  const userDataDir = resolveDesktopWebViewDir();

  let chromium;
  try {
    const requireFromPwa = createRequire(path.join(pwaDir, "package.json"));
    try {
      ({ chromium } = requireFromPwa("playwright"));
    } catch {
      ({ chromium } = requireFromPwa("@playwright/test"));
    }
  } catch (error) {
    console.warn(`Playwright unavailable: ${error instanceof Error ? error.message : String(error)}`);
    return purgeDesktopWebViewDirectory(userDataDir);
  }
  if (!userDataDir) {
    console.warn(`No EBWebView data at profile "${profileId}". Nothing to purge locally.`);
    return true;
  }

  console.log(`Using WebView profile: ${userDataDir}`);

  let context;
  try {
    context = await chromium.launchPersistentContext(userDataDir, {
      headless: true,
      args: ["--disable-dev-shm-usage"],
    });
  } catch (error) {
    console.warn(`Could not open WebView storage (is Obscur still running?): ${error instanceof Error ? error.message : String(error)}`);
    return purgeDesktopWebViewDirectory(userDataDir);
  }

  const page = context.pages()[0] ?? await context.newPage();
  try {
    await page.goto("http://127.0.0.1:3340/", { waitUntil: "domcontentloaded", timeout: 20_000 });
  } catch {
    // Storage purge only needs origin; about:blank also works for localStorage on that origin
    try {
      await page.goto("about:blank");
    } catch {
      // continue
    }
  }

  const report = await page.evaluate((matchList) => {
    const matches = (value) => {
      if (!matchList || matchList.length === 0) {
        return true;
      }
      const haystack = String(value ?? "").toLowerCase();
      return matchList.some((needle) => haystack.includes(String(needle).toLowerCase()));
    };

    const removedKeys = [];
    const keys = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key) {
        keys.push(key);
      }
    }

    const chatStatePrefix = "dweb.nostr.pwa.chatState";
    const chatStateKeys = keys.filter((key) => key.includes(chatStatePrefix));
    let purgedGroupCount = 0;

    chatStateKeys.forEach((storageKey) => {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        return;
      }
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return;
      }
      if (!parsed || typeof parsed !== "object") {
        return;
      }
      const groups = Array.isArray(parsed.createdGroups) ? parsed.createdGroups : [];
      const kept = [];
      const removed = [];
      groups.forEach((group) => {
        const name = String(group?.displayName ?? group?.name ?? "");
        const relay = String(group?.relayUrl ?? group?.relay ?? "");
        const groupId = String(group?.groupId ?? group?.id ?? "");
        if (matches(name) || matches(relay) || matches(groupId)) {
          removed.push(group);
        } else {
          kept.push(group);
        }
      });
      if (removed.length === 0) {
        return;
      }
      purgedGroupCount += removed.length;

      const removedConversationIds = new Set(
        removed.map((g) => String(g?.id ?? "").trim()).filter((id) => id.length > 0),
      );
      const removedCommunityIds = new Set(
        removed.map((g) => String(g?.communityId ?? "").trim()).filter((id) => id.length > 0),
      );

      const next = {
        ...parsed,
        createdGroups: kept,
        groupMessages: Object.fromEntries(
          Object.entries(parsed.groupMessages ?? {}).filter(([cid]) => !removedConversationIds.has(cid)),
        ),
        messagesByConversationId: Object.fromEntries(
          Object.entries(parsed.messagesByConversationId ?? {}).filter(([cid]) => !removedConversationIds.has(cid)),
        ),
        unreadByConversationId: Object.fromEntries(
          Object.entries(parsed.unreadByConversationId ?? {}).filter(([cid]) => !removedConversationIds.has(cid)),
        ),
      };
      localStorage.setItem(storageKey, JSON.stringify(next));

      keys.forEach((key) => {
        if (key.startsWith("obscur-last-chat-")) {
          const lastId = localStorage.getItem(key);
          if (lastId && removedConversationIds.has(lastId.trim())) {
            localStorage.removeItem(key);
            removedKeys.push(key);
          }
        }
        if (key.includes("obscur.community.")) {
          const shouldRemove = removedCommunityIds.size > 0 && (
            [...removedCommunityIds].some((communityId) => key.includes(communityId))
            || removed.some((g) => {
              const gid = String(g?.groupId ?? "");
              const relay = String(g?.relayUrl ?? "");
              return (gid && key.includes(gid)) || (relay && key.includes(relay.replace(/\//g, "")));
            })
          );
          if (shouldRemove) {
            localStorage.removeItem(key);
            removedKeys.push(key);
          }
        }
      });

      keys.filter((key) => key.includes("obscur.group.membership_ledger")).forEach((ledgerKey) => {
        const rawLedger = localStorage.getItem(ledgerKey);
        if (!rawLedger) {
          return;
        }
        try {
          const entries = JSON.parse(rawLedger);
          if (!Array.isArray(entries)) {
            return;
          }
          const filtered = entries.filter((entry) => {
            const name = String(entry?.displayName ?? "");
            const relay = String(entry?.relayUrl ?? "");
            const groupId = String(entry?.groupId ?? "");
            return !(matches(name) || matches(relay) || matches(groupId));
          });
          if (filtered.length !== entries.length) {
            localStorage.setItem(ledgerKey, JSON.stringify(filtered));
            removedKeys.push(ledgerKey);
          }
        } catch {
          // ignore
        }
      });
    });

    return {
      purgedGroupCount,
      removedKeys,
      chatStateKeysTouched: chatStateKeys.length,
    };
  }, matchSubstrings);

  await context.close();
  console.log(`Removed ${report.purgedGroupCount} group(s) from local chat state.`);
  if (report.removedKeys.length > 0) {
    console.log(`Cleared ${report.removedKeys.length} related localStorage key(s).`);
  }
  return true;
};

const main = async () => {
  console.log("Purge workspace communities");
  console.log(`Profile: ${profileId}`);
  console.log(matchSubstrings.length > 0
    ? `Match filter: ${matchSubstrings.join(", ")}`
    : "Match filter: ALL groups");

  const dbOk = purgeCoordinationDb();
  const localOk = await purgeBrowserLocalState();

  console.log("\nDone.");
  if (!dbOk || !localOk) {
    process.exitCode = 1;
    if (!localOk) {
      console.log("\nIf local purge failed: quit Obscur, then re-run: pnpm purge:workspace");
      console.log("Nuclear option (clears ALL app local data for this profile):");
      console.log(`  rm -rf "$APPDATA/app.obscur.desktop/profiles/${profileId}/EBWebView"`);
    }
  } else {
    console.log("Restart with: pnpm dev:desktop");
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
