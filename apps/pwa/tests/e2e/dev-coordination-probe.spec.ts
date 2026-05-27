import { expect, test } from "@playwright/test";

/** Browser fetch to coordination /health (G6-4 loopback path). */
test("browser can reach coordination /health when worker is up", async ({ page }) => {
  test.skip(!process.env.COORDINATION_EXPECT_UP, "Set COORDINATION_EXPECT_UP=1 when pnpm dev:coordination is running");
  await page.goto("/");
  const result = await page.evaluate(async () => {
    try {
      const response = await fetch("http://127.0.0.1:8787/health", { cache: "no-store" });
      const json = await response.json() as { ok?: boolean };
      return { ok: response.ok && json.ok === true, status: response.status };
    } catch (error) {
      return { ok: false, status: 0, error: error instanceof Error ? error.message : String(error) };
    }
  });
  expect(result.ok).toBe(true);
});
