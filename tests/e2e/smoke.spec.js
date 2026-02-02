import { expect, test } from "@playwright/test";

const baseUrl = process.env.PLAYWRIGHT_BASE_URL || "";

test.describe("Reliquary smoke", () => {
  test.skip(!baseUrl, "Set PLAYWRIGHT_BASE_URL to run the Playwright smoke suite");

  test("loads without console errors and shows core controls", async ({ page }) => {
    const consoleErrors = [];
    page.on("console", msg => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto(baseUrl);

    await page.waitForSelector("#relicType");
    await page.waitForSelector("#classFilter");

    const autoSort = page.locator("#autoSortBtn");
    if (await autoSort.count()) {
      await autoSort.first().click();
    }

    await expect(page.locator("#results")).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });
});
