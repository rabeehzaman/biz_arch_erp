import { expect, test } from "@playwright/test";

test.use({
  viewport: { width: 360, height: 800 },
  isMobile: true,
  hasTouch: true,
  storageState: { cookies: [], origins: [] },
});

test("login page stays mobile-safe", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByLabel(/email/i)).toBeVisible();

  const metrics = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));

  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
});
