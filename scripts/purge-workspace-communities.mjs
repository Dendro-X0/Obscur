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
 *   node scripts/purge-workspace-communities.mjs --match "Test 10" --nuclear
 *
 * --nuclear  Skip selective localStorage surgery; delete the entire EBWebView
 *            folder for this profile (quit Obscur first). Use when a stuck
 *            sovereign room keeps resurrecting from offline persistence layers.
 */

import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
const nuclearPurge = args.includes("--nuclear");
const killHolders = !args.includes("--no-kill-holders");

/** Dev desktop origins that store chat state in this WebView profile. */
const LOCAL_STORAGE_ORIGIN_PORTS = [3340, 1430];

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

const WEBVIEW_LOCK_PROCESS_NAMES = [
  "msedgewebview2.exe",
  "chrome-headless-shell.exe",
  "Obscur.exe",
  "obscur.exe",
];

const listWebViewProfileLockHolders = (userDataDir) => {
  if (!userDataDir || process.platform !== "win32") {
    return [];
  }
  const escaped = userDataDir.replace(/\\/g, "\\\\").replace(/'/g, "''");
  const nameFilter = WEBVIEW_LOCK_PROCESS_NAMES.map((name) => `$_.Name -ieq '${name}'`).join(" -or ");
  const ps = `
    $dir = '${escaped}';
    Get-CimInstance Win32_Process | Where-Object {
      ($_.CommandLine -and ($_.CommandLine -like "*$dir*") -and (${nameFilter}))
      -or ($_.Name -ieq 'Obscur.exe')
      -or ($_.Name -ieq 'obscur.exe')
    } | Select-Object Name, ProcessId, @{N='Cmd';E={$_.CommandLine}}
  `;
  const result = spawnSync("powershell", ["-NoProfile", "-Command", ps], { encoding: "utf8" });
  if (result.status !== 0 || !result.stdout?.trim()) {
    return [];
  }
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("Name"));
};

const releaseWebViewProfileLocks = (userDataDir) => {
  if (!userDataDir) {
    return;
  }
  console.log("Releasing processes that lock the WebView profile...");
  const holders = listWebViewProfileLockHolders(userDataDir);
  if (holders.length > 0) {
    console.log("Lock holders found (Obscur, stale Playwright purge, or WebView2):");
    holders.slice(0, 8).forEach((line) => console.log(`  ${line}`));
    if (holders.length > 8) {
      console.log(`  ... and ${holders.length - 8} more`);
    }
  } else {
    console.log("No lock holders detected via profile path scan.");
  }

  if (process.platform === "win32") {
    const escaped = userDataDir.replace(/\\/g, "\\\\").replace(/'/g, "''");
    const nameFilter = WEBVIEW_LOCK_PROCESS_NAMES.map((name) => `$_.Name -ieq '${name}'`).join(" -or ");
    const ps = `
      $dir = '${escaped}';
      Get-CimInstance Win32_Process | Where-Object {
        ($_.CommandLine -and ($_.CommandLine -like "*$dir*") -and (${nameFilter}))
        -or ($_.Name -ieq 'Obscur.exe')
        -or ($_.Name -ieq 'obscur.exe')
      } | ForEach-Object {
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
      }
    `;
    spawnSync("powershell", ["-NoProfile", "-Command", ps], { encoding: "utf8" });
  } else {
    spawnSync("pkill", ["-f", userDataDir], { encoding: "utf8" });
  }
};

const purgeDesktopWebViewDirectory = async (userDataDir, options = {}) => {
  const shouldKillHolders = options.killHolders ?? killHolders;
  if (!userDataDir) {
    return false;
  }
  if (shouldKillHolders) {
    releaseWebViewProfileLocks(userDataDir);
    await sleep(1500);
  }

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      fs.rmSync(userDataDir, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 300,
      });
      console.log("Removed desktop WebView storage (all local UI data for this profile).");
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Remove attempt ${attempt}/4 failed: ${message}`);
      if (attempt < 4) {
        if (shouldKillHolders) {
          releaseWebViewProfileLocks(userDataDir);
        }
        await sleep(2000);
      }
    }
  }

  console.error("\nCould not delete EBWebView — files are still locked.");
  console.error("1. Close every Obscur window (File → Exit, not only the X button).");
  console.error("2. End any chrome-headless-shell.exe left from a previous purge.");
  console.error("3. Re-run: pnpm purge:workspace --match \"Test 10\" --nuclear");
  console.error(`   Profile path: ${userDataDir}`);
  return false;
};

const startLocalStorageOriginServers = async () => {
  const servers = [];
  const stopFns = [];

  for (const port of LOCAL_STORAGE_ORIGIN_PORTS) {
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end("<!doctype html><html><body>obscur purge origin</body></html>");
    });
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, "127.0.0.1", () => resolve());
    });
    servers.push(server);
    stopFns.push(() => server.close());
  }

  return () => {
    stopFns.forEach((stop) => stop());
  };
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
  console.log("Quit Obscur completely before this step (stale Playwright also locks the profile).");

  const userDataDir = resolveDesktopWebViewDir();
  if (killHolders && userDataDir) {
    releaseWebViewProfileLocks(userDataDir);
    await sleep(1500);
  }

  let stopOriginServers = null;
  try {
    stopOriginServers = await startLocalStorageOriginServers();
    console.log(`Started local origin stubs on 127.0.0.1:${LOCAL_STORAGE_ORIGIN_PORTS.join(", ")}`);
  } catch (error) {
    console.warn(`Could not start origin stubs (is dev desktop still running?): ${error instanceof Error ? error.message : String(error)}`);
  }

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
    if (stopOriginServers) {
      stopOriginServers();
    }
    return await purgeDesktopWebViewDirectory(userDataDir);
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
    if (stopOriginServers) {
      stopOriginServers();
    }
    return await purgeDesktopWebViewDirectory(userDataDir);
  }

  const page = context.pages()[0] ?? await context.newPage();
  const storageOrigins = [
    ...LOCAL_STORAGE_ORIGIN_PORTS.flatMap((port) => [
      `http://127.0.0.1:${port}/`,
      `http://localhost:${port}/`,
    ]),
    "https://asset.localhost/",
    "http://asset.localhost/",
  ];
  let storageOrigin = null;
  let totalPurgedGroups = 0;
  const allRemovedKeys = [];
  const allTombstones = [];

  for (const origin of storageOrigins) {
    try {
      await page.goto(origin, { waitUntil: "domcontentloaded", timeout: 8_000 });
      const canAccess = await page.evaluate(() => {
        try {
          return typeof localStorage !== "undefined" && localStorage.length >= 0;
        } catch {
          return false;
        }
      });
      if (!canAccess) {
        continue;
      }
      storageOrigin = origin;
      console.log(`Purging via storage origin: ${origin}`);
      const originReport = await page.evaluate((matchList) => {
    const matches = (value) => {
      if (!matchList || matchList.length === 0) {
        return true;
      }
      const haystack = String(value ?? "").toLowerCase();
      return matchList.some((needle) => haystack.includes(String(needle).toLowerCase()));
    };

    const matchesScope = (scope) => (
      matches(scope.displayName)
      || matches(scope.relayUrl)
      || matches(scope.groupId)
      || matches(scope.conversationId)
      || matches(scope.communityId)
    );

    const toTombstoneKey = (groupId, relayUrl) => {
      const gid = String(groupId ?? "").trim();
      const relay = String(relayUrl ?? "").trim();
      if (!gid) {
        return null;
      }
      return `${gid}@@${relay.length > 0 ? relay : "unknown"}`;
    };

    const removedKeys = [];
    const tombstonesAdded = [];
    const keys = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key) {
        keys.push(key);
      }
    }

    const removedScopes = [];
    const rememberScope = (scope) => {
      if (!matchesScope(scope)) {
        return;
      }
      removedScopes.push(scope);
    };

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
        const scope = {
          displayName: String(group?.displayName ?? group?.name ?? ""),
          relayUrl: String(group?.relayUrl ?? group?.relay ?? ""),
          groupId: String(group?.groupId ?? ""),
          conversationId: String(group?.id ?? ""),
          communityId: String(group?.communityId ?? ""),
        };
        if (matchesScope(scope)) {
          removed.push(group);
          rememberScope(scope);
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
        const filtered = [];
        entries.forEach((entry) => {
          const scope = {
            displayName: String(entry?.displayName ?? ""),
            relayUrl: String(entry?.relayUrl ?? ""),
            groupId: String(entry?.groupId ?? ""),
            conversationId: "",
            communityId: String(entry?.communityId ?? ""),
          };
          if (matchesScope(scope)) {
            rememberScope(scope);
          } else {
            filtered.push(entry);
          }
        });
        if (filtered.length !== entries.length) {
          localStorage.setItem(ledgerKey, JSON.stringify(filtered));
          removedKeys.push(ledgerKey);
        }
      } catch {
        // ignore
      }
    });

    keys.filter((key) => key.includes("obscur.group.leave_outbox")).forEach((outboxKey) => {
      const rawOutbox = localStorage.getItem(outboxKey);
      if (!rawOutbox) {
        return;
      }
      try {
        const items = JSON.parse(rawOutbox);
        if (!Array.isArray(items)) {
          return;
        }
        const filtered = items.filter((item) => {
          const scope = {
            displayName: "",
            relayUrl: String(item?.relayUrl ?? ""),
            groupId: String(item?.groupId ?? ""),
            conversationId: "",
            communityId: String(item?.communityId ?? ""),
          };
          return !matchesScope(scope);
        });
        if (filtered.length !== items.length) {
          if (filtered.length === 0) {
            localStorage.removeItem(outboxKey);
          } else {
            localStorage.setItem(outboxKey, JSON.stringify(filtered));
          }
          removedKeys.push(outboxKey);
        }
      } catch {
        // ignore
      }
    });

    keys.filter((key) => key.startsWith("obscur:room-keys:v1")).forEach((roomKeyStorageKey) => {
      const rawRoomKeys = localStorage.getItem(roomKeyStorageKey);
      if (!rawRoomKeys) {
        return;
      }
      try {
        const parsed = JSON.parse(rawRoomKeys);
        if (!parsed || typeof parsed !== "object") {
          return;
        }
        const next = {};
        let changed = false;
        Object.entries(parsed).forEach(([groupId, record]) => {
          const scope = {
            displayName: "",
            relayUrl: "",
            groupId: String(groupId),
            conversationId: "",
            communityId: "",
          };
          if (matchesScope(scope) || matches(String(record?.groupId ?? groupId))) {
            changed = true;
            rememberScope({ ...scope, groupId: String(record?.groupId ?? groupId) });
          } else {
            next[groupId] = record;
          }
        });
        if (changed) {
          if (Object.keys(next).length === 0) {
            localStorage.removeItem(roomKeyStorageKey);
          } else {
            localStorage.setItem(roomKeyStorageKey, JSON.stringify(next));
          }
          removedKeys.push(roomKeyStorageKey);
        }
      } catch {
        // ignore
      }
    });

    keys.filter((key) => key.includes("obscur.groups.known_participants")).forEach((participantsKey) => {
      const raw = localStorage.getItem(participantsKey);
      if (!raw) {
        return;
      }
      try {
        const entries = JSON.parse(raw);
        if (!Array.isArray(entries)) {
          return;
        }
        const filtered = entries.filter((entry) => {
          const scope = {
            displayName: "",
            relayUrl: String(entry?.relayUrl ?? ""),
            groupId: String(entry?.groupId ?? ""),
            conversationId: String(entry?.conversationId ?? ""),
            communityId: String(entry?.communityId ?? ""),
          };
          return !matchesScope(scope);
        });
        if (filtered.length !== entries.length) {
          if (filtered.length === 0) {
            localStorage.removeItem(participantsKey);
          } else {
            localStorage.setItem(participantsKey, JSON.stringify(filtered));
          }
          removedKeys.push(participantsKey);
        }
      } catch {
        // ignore
      }
    });

    const addTombstonesToStorageKey = (tombstoneStorageKey) => {
      const existingRaw = localStorage.getItem(tombstoneStorageKey);
      const existing = new Set();
      if (existingRaw) {
        try {
          const parsed = JSON.parse(existingRaw);
          if (Array.isArray(parsed)) {
            parsed.forEach((value) => {
              if (typeof value === "string" && value.trim().length > 0) {
                existing.add(value);
              }
            });
          }
        } catch {
          // ignore
        }
      }
      let changed = false;
      removedScopes.forEach((scope) => {
        const key = toTombstoneKey(scope.groupId, scope.relayUrl);
        if (key && !existing.has(key)) {
          existing.add(key);
          tombstonesAdded.push(key);
          changed = true;
        }
      });
      if (changed) {
        localStorage.setItem(tombstoneStorageKey, JSON.stringify(Array.from(existing)));
        removedKeys.push(tombstoneStorageKey);
      }
    };

    const pubkeySuffixes = new Set();
    keys.forEach((key) => {
      const match = key.match(/obscur\.group\.(?:membership_ledger|tombstones)\.v1\.([0-9a-f]{64})/i);
      if (match) {
        pubkeySuffixes.add(match[1]);
      }
    });
    const tombstoneKeys = keys.filter((key) => key.includes("obscur.group.tombstones.v1"));
    if (tombstoneKeys.length > 0) {
      tombstoneKeys.forEach((tombstoneStorageKey) => addTombstonesToStorageKey(tombstoneStorageKey));
    } else {
      pubkeySuffixes.forEach((pubkey) => {
        addTombstonesToStorageKey(`obscur.group.tombstones.v1.${pubkey}`);
      });
    }

    keys.forEach((key) => {
      if (key.startsWith("obscur-last-chat-")) {
        const lastId = localStorage.getItem(key);
        if (lastId && removedScopes.some((scope) => scope.conversationId && lastId.trim() === scope.conversationId)) {
          localStorage.removeItem(key);
          removedKeys.push(key);
        }
      }
      if (key.includes("obscur.community.")) {
        const shouldRemove = removedScopes.some((scope) => (
          (scope.communityId && key.includes(scope.communityId))
          || (scope.groupId && key.includes(scope.groupId))
          || (scope.relayUrl && key.includes(scope.relayUrl.replace(/\//g, "")))
        ));
        if (shouldRemove) {
          localStorage.removeItem(key);
          removedKeys.push(key);
        }
      }
    });

    return {
      purgedGroupCount,
      removedKeys,
      tombstonesAdded,
      chatStateKeysTouched: chatStateKeys.length,
      removedScopeCount: removedScopes.length,
    };
      }, matchSubstrings);
      totalPurgedGroups += originReport.purgedGroupCount ?? 0;
      allRemovedKeys.push(...(originReport.removedKeys ?? []));
      allTombstones.push(...(originReport.tombstonesAdded ?? []));
    } catch {
      // try next origin
    }
  }

  await context.close();
  if (stopOriginServers) {
    stopOriginServers();
  }
  if (userDataDir && killHolders) {
    releaseWebViewProfileLocks(userDataDir);
  }

  if (!storageOrigin) {
    console.warn("Could not access desktop WebView localStorage on any known origin.");
    console.warn("Quit Obscur, then re-run with --nuclear:");
    console.warn(`  pnpm purge:workspace --match "${matchSubstrings.join(", ")}" --nuclear`);
    return false;
  }

  console.log(`Removed ${totalPurgedGroups} group(s) from local chat state.`);
  if (allTombstones.length > 0) {
    console.log(`Added ${allTombstones.length} tombstone(s) to block offline resurrection.`);
  }
  if (allRemovedKeys.length > 0) {
    console.log(`Touched ${allRemovedKeys.length} related localStorage key(s).`);
  }
  return totalPurgedGroups > 0 || allRemovedKeys.length > 0;
};

const main = async () => {
  console.log("Purge workspace communities");
  console.log(`Profile: ${profileId}`);
  console.log(matchSubstrings.length > 0
    ? `Match filter: ${matchSubstrings.join(", ")}`
    : "Match filter: ALL groups");

  if (nuclearPurge) {
    console.log("\n[NUCLEAR] Removing entire desktop WebView profile storage...");
    const userDataDir = resolveDesktopWebViewDir();
    if (!userDataDir) {
      console.warn(`No EBWebView data at profile "${profileId}".`);
      process.exitCode = 1;
      return;
    }
    const dbOk = purgeCoordinationDb();
    const localOk = await purgeDesktopWebViewDirectory(userDataDir);
    console.log("\nDone.");
    if (!dbOk || !localOk) {
      process.exitCode = 1;
    } else {
      console.log("Restart with: pnpm dev:desktop:online");
    }
    return;
  }

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
