import { expect, test } from "@playwright/test";
import {
  createApiContext,
  createBranch,
  createPosProductAndStock,
  createWarehouse,
  makeRunId,
  openPosSession,
} from "./helpers/pos";

import type { Page } from "@playwright/test";

function cartItemLocator(page: Page, productName: string) {
  return page
    .locator('div.rounded-lg.border.bg-white')
    .filter({ hasText: productName })
    .filter({ has: page.locator("svg.lucide-trash2") })
    .first();
}

function makeSpecRunId(label: string) {
  return `${makeRunId()}-${label}-${Math.random().toString(36).slice(2, 8)}`;
}

test.describe("POS cart visibility", () => {
  test.setTimeout(120_000);

  test("shows quantity 2 after clicking the same product twice and hides inline cart controls", async ({ page, baseURL }) => {
    const api = await createApiContext(baseURL!, "admin");
    const runId = makeSpecRunId("click");
    const branch = await createBranch(api, runId);
    const warehouse = await createWarehouse(api, branch.id, runId);
    await createPosProductAndStock(api, {
      runId,
      branchId: branch.id,
      warehouseId: warehouse.id,
      quantity: 20,
      unitCost: 25,
      unitPrice: 50,
    });
    const session = await openPosSession(api, {
      branchId: branch.id,
      warehouseId: warehouse.id,
      openingCash: 100,
    });

    const productName = `POS Product ${runId}`;

    await page.goto(`/pos/terminal?sessionId=${session.id}`);
    const productTile = page.locator("button").filter({ hasText: productName }).first();
    await expect(productTile).toBeVisible();

    await productTile.click();
    await productTile.click();

    const cartItem = cartItemLocator(page, productName);
    await expect(cartItem).toBeVisible();
    await expect(cartItem.getByText("x2", { exact: true })).toBeVisible();
    await expect(cartItem.locator("svg.lucide-plus")).toHaveCount(0);
    await expect(cartItem.locator("svg.lucide-minus")).toHaveCount(0);
    await expect(cartItem.locator("svg.lucide-percent")).toHaveCount(0);

    await api.dispose();
  });

  test("shows quantity 2 after scanning the same SKU twice", async ({ page, baseURL }) => {
    const api = await createApiContext(baseURL!, "admin");
    const runId = makeSpecRunId("scan");
    const branch = await createBranch(api, runId);
    const warehouse = await createWarehouse(api, branch.id, runId);
    await createPosProductAndStock(api, {
      runId,
      branchId: branch.id,
      warehouseId: warehouse.id,
      quantity: 20,
      unitCost: 25,
      unitPrice: 50,
    });
    const session = await openPosSession(api, {
      branchId: branch.id,
      warehouseId: warehouse.id,
      openingCash: 100,
    });

    const productName = `POS Product ${runId}`;
    const sku = `POS-${runId}`;

    await page.goto(`/pos/terminal?sessionId=${session.id}`);
    await expect(page.locator("button").filter({ hasText: productName }).first()).toBeVisible();

    await page.getByRole("button", { name: "All", exact: true }).click();
    await page.keyboard.type(sku, { delay: 10 });
    await page.keyboard.press("Enter");
    const cartItem = cartItemLocator(page, productName);
    await expect(cartItem).toBeVisible();
    await expect(cartItem.getByText("x1", { exact: true })).toBeVisible();
    await page.keyboard.type(sku, { delay: 10 });
    await page.keyboard.press("Enter");

    await expect(cartItem.getByText("x2", { exact: true })).toBeVisible();

    await api.dispose();
  });
});
