import { defineConfig, devices } from "@playwright/test";

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3340";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["runtime-capture-desktop.spec.ts", "dm-kernel-cdp-gate.spec.ts"],
  timeout: 180_000,
  expect: {
    timeout: 60_000,
  },
  retries: 0,
  use: {
    baseURL: baseUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "runtime-capture",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  reporter: [["list"], ["json", { outputFile: "test-results/runtime-capture/playwright-report.json" }]],
});
