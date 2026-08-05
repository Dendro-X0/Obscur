import { defineConfig, devices } from "@playwright/test";

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:1430";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["u2-l3-group-persist-cdp.spec.ts"],
  timeout: 360_000,
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
      name: "u2-l3",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  reporter: [["list"], ["json", { outputFile: "test-results/u2-l3/playwright-report.json" }]],
});
