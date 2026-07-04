import { createRequire } from "node:module";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requirePwa = createRequire(path.join(repoRoot, "apps/pwa/package.json"));
const pw = requirePwa("playwright");

const snapshot = {
  currentWindow: { windowLabel: "main", profileId: "default", profileLabel: "Default", launchMode: "existing" },
  profiles: [{ profileId: "default", label: "Default", createdAtUnixMs: 1, lastUsedAtUnixMs: Date.now() }],
  windowBindings: [{ windowLabel: "main", profileId: "default", profileLabel: "Default", launchMode: "existing" }],
};

const proc = spawn("npx", ["--yes", "serve", "-s", "apps/pwa/out", "-l", "3342"], { cwd: repoRoot, shell: true, stdio: "ignore" });
await new Promise((resolve) => setTimeout(resolve, 4000));
const browser = await pw.chromium.launch({ headless: true });
const context = await browser.newContext();
await context.addInitScript((mockSnapshot) => {
  window.__OBSCUR_WINDOW_BOOT__ = { windowLabel: "main", profileId: "default", launchMode: "existing" };
  window.__TAURI_INTERNALS__ = {
    invoke: async (cmd) => (cmd === "desktop_get_profile_isolation_snapshot" ? mockSnapshot : null),
  };
}, snapshot);
const page = await context.newPage();
await page.goto("http://127.0.0.1:3342/profiles", { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForTimeout(5000);
console.log("URL", page.url());
console.log("BODY", (await page.locator("body").innerText()).slice(0, 1200));
await browser.close();
proc.kill();
