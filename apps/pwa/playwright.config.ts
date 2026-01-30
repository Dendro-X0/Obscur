import type { PlaywrightTestConfig } from "@playwright/test";
import { defineConfig, devices } from "@playwright/test";

const isCi: boolean = process.env.CI === "true";
const defaultBaseUrl: string = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const webServerCommand: string = isCi ? "pnpm build && pnpm start -p 3000" : "pnpm dev -p 3000";

const config: PlaywrightTestConfig = defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  retries: isCi ? 2 : 0,
  webServer: {
    command: webServerCommand,
    url: defaultBaseUrl,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  use: {
    baseURL: defaultBaseUrl,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  reporter: isCi ? [["github"], ["list"]] : [["list"]],
});

export default config;
