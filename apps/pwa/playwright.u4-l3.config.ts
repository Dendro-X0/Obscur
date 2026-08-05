import { defineConfig, devices } from "@playwright/test";

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:1430";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["u4-l3-leave-cdp.spec.ts"],
  timeout: 240_000,
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
      name: "u4-l3-leave",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  reporter: [["list"], ["json", { outputFile: "test-results/u4-l3-leave/playwright-report.json" }]],
});
