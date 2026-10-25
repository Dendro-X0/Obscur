/**
 * Welcome + create-identity mobile check (iPhone SE).
 * Usage: node scripts/mobile-layout-audit-welcome.mjs
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const playwrightRoot = path.dirname(
  require.resolve("playwright/package.json", {
    paths: [
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../node_modules/.pnpm/playwright@1.61.1/node_modules"),
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../node_modules"),
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../node_modules"),
    ],
  }),
);
const { chromium, devices } = await import(pathToFileURL(path.join(playwrightRoot, "index.mjs")).href);

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const outDir = path.join(repoRoot, ".tmp", "mobile-audit");
fs.mkdirSync(outDir, { recursive: true });
const baseUrl = process.env.MOBILE_AUDIT_BASE_URL || "http://127.0.0.1:3340";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ ...devices["iPhone SE"], locale: "en-US" });
const page = await context.newPage();
page.setDefaultTimeout(45000);

await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);
await page.screenshot({ path: path.join(outDir, "se-welcome-stamp-check.png"), fullPage: true });

const welcomeMetrics = await page.evaluate(() => {
  const stamp = document.querySelector('[data-testid="client-surface-revision"]');
  const stampRect = stamp?.getBoundingClientRect() ?? null;
  const ctaTexts = ["Create New Identity", "Log In with Key", "Restore from backup"];
  const overlaps = [];
  for (const text of ctaTexts) {
    const btn = Array.from(document.querySelectorAll("button")).find((b) =>
      (b.innerText || "").includes(text),
    );
    if (!btn || !stampRect) continue;
    const r = btn.getBoundingClientRect();
    const hit = !(
      stampRect.right < r.left
      || stampRect.left > r.right
      || stampRect.bottom < r.top
      || stampRect.top > r.bottom
    );
    if (hit) overlaps.push(text);
  }
  const lang = document.querySelector('button[aria-label*="anguage"], button:has(svg)');
  return {
    overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    stampTop: stampRect ? Math.round(stampRect.top) : null,
    stampLeft: stampRect ? Math.round(stampRect.left) : null,
    overlapsCtas: overlaps,
  };
});
console.log("welcome", JSON.stringify(welcomeMetrics));

const createBtn = page.getByRole("button", { name: /Create New Identity/i });
if (await createBtn.isVisible().catch(() => false)) {
  await createBtn.click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(outDir, "se-create-identity.png"), fullPage: true });
  const createMetrics = await page.evaluate(() => ({
    url: location.href,
    overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    sample: (document.body.innerText || "").slice(0, 400).replace(/\s+/g, " "),
  }));
  console.log("create", JSON.stringify(createMetrics));
} else {
  console.log("create", JSON.stringify({ skipped: true }));
}

await browser.close();
