import { defineConfig, devices } from "@playwright/test";

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:1430";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["u6-l3-invite-role-cdp.spec.ts"],
  timeout: 300_000,
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
      name: "u6-l3-invite-role",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  reporter: [["list"], ["json", { outputFile: "test-results/u6-l3-invite-role/playwright-report.json" }]],
});
