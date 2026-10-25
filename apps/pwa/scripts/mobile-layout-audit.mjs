/**
 * One-shot mobile layout audit against http://127.0.0.1:3340
 * Usage (from apps/pwa): pnpm exec node scripts/mobile-layout-audit.mjs
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

const viewports = [
  { name: "iphone-se", ...devices["iPhone SE"] },
  { name: "pixel-5", ...devices["Pixel 5"] },
  { name: "iphone-14-pro", ...devices["iPhone 14 Pro"] },
];

const routes = ["/", "/network", "/settings", "/vault"];
const findings = [];
const baseUrl = process.env.MOBILE_AUDIT_BASE_URL || "http://127.0.0.1:3340";

const browser = await chromium.launch({ headless: true });

for (const device of viewports) {
  const context = await browser.newContext({
    ...device,
    locale: "en-US",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(45000);

  for (const route of routes) {
    const label = `${device.name}${route === "/" ? "-home" : route.replaceAll("/", "-")}`;
    try {
      const response = await page.goto(`${baseUrl}${route}`, {
        waitUntil: "domcontentloaded",
        timeout: 45000,
      });
      await page.waitForTimeout(2500);
      const finalUrl = page.url();
      const status = response?.status() ?? null;

      const metrics = await page.evaluate(() => {
        const doc = document.documentElement;
        const body = document.body;
        const scrollWidth = Math.max(doc.scrollWidth, body?.scrollWidth ?? 0);
        const clientWidth = doc.clientWidth;
        const overflowX = scrollWidth > clientWidth + 1;
        const candidates = Array.from(
          document.querySelectorAll("button, a, [role='button']"),
        ).slice(0, 100);
        let tinyTap = 0;
        for (const el of candidates) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0 && (r.width < 40 || r.height < 40)) {
            tinyTap += 1;
          }
        }
        let wideEls = 0;
        const wideSamples = [];
        for (const el of Array.from(
          document.querySelectorAll("div, section, main, header, nav"),
        ).slice(0, 250)) {
          const r = el.getBoundingClientRect();
          if (r.width > clientWidth + 8) {
            wideEls += 1;
            if (wideSamples.length < 5) {
              wideSamples.push({
                tag: el.tagName.toLowerCase(),
                className: String(el.className || "").slice(0, 120),
                width: Math.round(r.width),
              });
            }
          }
        }
        return {
          title: document.title,
          clientWidth,
          scrollWidth,
          overflowX,
          bodyTextSample: (body?.innerText || "")
            .slice(0, 280)
            .replace(/\s+/g, " "),
          tinyTap,
          wideEls,
          wideSamples,
        };
      });

      const shot = path.join(outDir, `${label}.png`);
      await page.screenshot({ path: shot, fullPage: true });

      findings.push({
        device: device.name,
        route,
        finalUrl,
        status,
        ...metrics,
        screenshot: shot,
      });
      console.log(
        JSON.stringify({
          ok: true,
          label,
          status,
          finalUrl,
          overflowX: metrics.overflowX,
          wideEls: metrics.wideEls,
          tinyTap: metrics.tinyTap,
        }),
      );
    } catch (error) {
      findings.push({
        device: device.name,
        route,
        error: error instanceof Error ? error.message : String(error),
      });
      console.log(JSON.stringify({ ok: false, label, error: String(error) }));
    }
  }
  await context.close();
}

await browser.close();
fs.writeFileSync(
  path.join(outDir, "findings.json"),
  JSON.stringify(findings, null, 2),
);
console.log("WROTE", path.join(outDir, "findings.json"));
const overflow = findings.filter((f) => f.overflowX);
console.log(
  JSON.stringify({
    total: findings.length,
    overflowCount: overflow.length,
    errors: findings.filter((f) => f.error).length,
  }),
);
