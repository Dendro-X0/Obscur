/**
 * Shared reload helper for Dev Lab Playwright CLI scenarios.
 * @param {import('playwright').Page} page
 */
export async function reloadDevLabPage(page) {
  await page.reload({ waitUntil: "load", timeout: 120_000 });
}
