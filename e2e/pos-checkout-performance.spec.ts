import { expect, test } from "@playwright/test";
import {
  createApiContext,
  createBranch,
  createWarehouse,
  makeRunId,
  openPosSession,
} from "./helpers/pos";

function makeSpecRunId(label: string) {
  return `${makeRunId()}-${label}-${Math.random().toString(36).slice(2, 8)}`;
}

test.describe("POS checkout performance plumbing", () => {
  test.setTimeout(120_000);

  test("returns checkout timings and clears the cart after a UI checkout", async ({
    page,
    baseURL,
  }) => {
    const api = await createApiContext(baseURL!, "admin");

    try {
      const runId = makeSpecRunId("checkout-performance");
      const branch = await createBranch(api, runId);
      const warehouse = await createWarehouse(api, branch.id, runId);
      const session = await openPosSession(api, {
        branchId: branch.id,
        warehouseId: warehouse.id,
        openingCash: 100,
      });

      const productsResponse = await api.get("/api/pos/products");
      expect(productsResponse.ok()).toBeTruthy();
      const products = await productsResponse.json();
      expect(Array.isArray(products) && products.length > 0).toBeTruthy();

      const consoleMessages: string[] = [];
      const pageErrors: string[] = [];
      page.on("console", (message) => {
        consoleMessages.push(`[${message.type()}] ${message.text()}`);
      });
      page.on("pageerror", (error) => {
        pageErrors.push(error.message);
      });

      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(`/pos/terminal?sessionId=${session.id}`);

      const productGrid = page.getByTestId("pos-product-grid");
      await expect(productGrid).toBeVisible();
      const productTile = productGrid.locator("button").first();
      await expect(productTile).toBeVisible();
      await productTile.click();

      const payNowButton = page.getByRole("button", { name: /^Pay Now/i });
      await expect(payNowButton).toBeVisible();
      await payNowButton.click();

      const checkoutResponsePromise = page.waitForResponse((response) =>
        response.url().includes("/api/pos/checkout") &&
        response.request().method() === "POST" &&
        response.status() === 201
      );

      await page.getByRole("button", { name: /Complete Sale/i }).click();

      const checkoutResponse = await checkoutResponsePromise;
      const checkoutBody = await checkoutResponse.json();

      expect(checkoutBody.timings?.requestTotalMs).toBeGreaterThan(0);
      expect(checkoutBody.timings?.transactionStages).toMatchObject({
        session_and_register: expect.any(Number),
        invoice_create: expect.any(Number),
        payments: expect.any(Number),
        finalize: expect.any(Number),
      });

      await expect(page.getByText(/empty cart/i)).toBeVisible();
      await expect(productGrid.locator("button").first()).toBeVisible();
      await expect
        .poll(() =>
          consoleMessages.some((message) =>
            message.includes("[pos-checkout] client timings")
          )
        )
        .toBe(true);
      await expect
        .poll(() =>
          consoleMessages.some((message) =>
            message.includes("[pos-checkout] server timings")
          )
        )
        .toBe(true);

      expect(pageErrors).toEqual([]);
      expect(
        consoleMessages.filter((message) =>
          message.includes("Background revalidation failed")
        )
      ).toHaveLength(0);
    } finally {
      await api.dispose();
    }
  });
});
